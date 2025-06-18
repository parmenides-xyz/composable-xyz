// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../../Vault.sol";
import "../../interfaces/Strategies.sol";

/// @title CrossChainVaultReceiver
/// @notice Receives bridged funds from Story Protocol chain and deploys to Ethereum strategies
contract CrossChainVaultReceiver is ReentrancyGuard, AccessControl {
    using SafeERC20 for IERC20;

    // ============ State Variables ============
    
    /// @notice Role for cross-chain bridge operations
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");
    
    /// @notice Role for strategy execution
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    
    /// @notice Underlying vault for strategy management
    Vault public immutable vault;
    
    /// @notice Mapping of supported tokens
    mapping(address => bool) public supportedTokens;
    address[] public tokenList;
    
    /// @notice Strategy selection algorithm
    mapping(address => address[]) public tokenStrategies; // token => strategy array
    mapping(address => uint256) public strategyWeights; // strategy => weight (basis points)
    
    /// @notice Total received from cross-chain
    mapping(address => uint256) public totalReceived;
    
    /// @notice Total deployed to strategies
    mapping(address => uint256) public totalDeployed;
    
    /// @notice Emergency pause
    bool public paused;

    // ============ Events ============
    
    event FundsReceived(address indexed token, uint256 amount, bytes32 indexed txHash);
    event FundsDeployed(address indexed token, address indexed strategy, uint256 amount);
    event StrategyAdded(address indexed token, address indexed strategy, uint256 weight);
    event StrategyRemoved(address indexed token, address indexed strategy);
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);
    event EmergencyPause(bool paused);
    event YieldHarvested(address indexed strategy, uint256 amount);

    // ============ Errors ============
    
    error UnsupportedToken();
    error InvalidStrategy();
    error InvalidWeight();
    error StrategyNotFound();
    error InsufficientBalance();
    error DeploymentFailed();
    error ContractPaused();
    error InvalidAmount();

    // ============ Modifiers ============
    
    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }
    
    modifier onlyBridge() {
        require(hasRole(BRIDGE_ROLE, msg.sender), "Not authorized bridge");
        _;
    }
    
    modifier onlyExecutor() {
        require(hasRole(EXECUTOR_ROLE, msg.sender), "Not authorized executor");
        _;
    }

    // ============ Constructor ============
    
    constructor(
        address _vault,
        address _bridgeOperator,
        address _executor
    ) {
        vault = Vault(_vault);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BRIDGE_ROLE, _bridgeOperator);
        _grantRole(EXECUTOR_ROLE, _executor);
    }

    // ============ External Functions ============
    
    /// @notice Receives funds from cross-chain bridge
    /// @param token Token address received
    /// @param amount Amount received
    /// @param data Additional data from bridge (contains strategy instructions)
    function receiveFunds(
        address token,
        uint256 amount,
        bytes calldata data
    ) external onlyBridge whenNotPaused nonReentrant {
        if (!supportedTokens[token]) revert UnsupportedToken();
        if (amount == 0) revert InvalidAmount();
        
        // Record receipt
        totalReceived[token] += amount;
        
        // Parse strategy data if provided
        bytes32 txHash = bytes32(0);
        if (data.length >= 32) {
            txHash = abi.decode(data, (bytes32));
        }
        
        emit FundsReceived(token, amount, txHash);
        
        // Auto-deploy to strategies
        _deployToStrategies(token, amount, data);
    }
    
    /// @notice Manually deploy funds to specific strategy
    /// @param token Token to deploy
    /// @param strategy Strategy address
    /// @param amount Amount to deploy
    function deployToStrategy(
        address token,
        address strategy,
        uint256 amount
    ) external onlyExecutor whenNotPaused nonReentrant {
        if (!supportedTokens[token]) revert UnsupportedToken();
        if (!_isValidStrategy(token, strategy)) revert InvalidStrategy();
        
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance < amount) revert InsufficientBalance();
        
        _executeStrategyDeployment(token, strategy, amount);
    }
    
    /// @notice Harvest yields from all strategies
    /// @param token Token to harvest
    function harvestAll(address token) external onlyExecutor whenNotPaused {
        if (!supportedTokens[token]) revert UnsupportedToken();
        
        address[] memory strategies = tokenStrategies[token];
        
        for (uint256 i = 0; i < strategies.length; i++) {
            try IStrategies(strategies[i]).harvest("") {
                uint256 balance = IERC20(token).balanceOf(address(this));
                if (balance > 0) {
                    emit YieldHarvested(strategies[i], balance);
                }
            } catch {
                // Continue with other strategies if one fails
            }
        }
    }
    
    /// @notice Emergency exit from all strategies
    /// @param token Token to exit
    function emergencyExitAll(address token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!supportedTokens[token]) revert UnsupportedToken();
        
        address[] memory strategies = tokenStrategies[token];
        
        for (uint256 i = 0; i < strategies.length; i++) {
            try IStrategies(strategies[i]).emergencyExit("") {
                // Emergency exit completed
            } catch {
                // Continue with other strategies
            }
        }
        
        // Pause contract after emergency exit
        paused = true;
        emit EmergencyPause(true);
    }
    
    /// @notice Send harvested yields back to source chain
    /// @param token Token to send back
    /// @param amount Amount to send
    /// @param targetChainId Target chain ID (Story Protocol)
    /// @param recipient Recipient address on target chain
    function sendYieldBack(
        address token,
        uint256 amount,
        uint256 targetChainId,
        address recipient
    ) external payable onlyExecutor whenNotPaused {
        if (!supportedTokens[token]) revert UnsupportedToken();
        
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance < amount) revert InsufficientBalance();
        
        // Use vault's bridge functionality to send back
        vault.deployToChain{value: msg.value}(
            targetChainId,
            amount,
            abi.encode(recipient, "yield_return")
        );
    }

    // ============ Internal Functions ============
    
    /// @notice Deploy funds to strategies based on weights
    /// @param token Token to deploy
    /// @param amount Total amount to deploy
    /// @param data Additional strategy data
    function _deployToStrategies(
        address token,
        uint256 amount,
        bytes calldata data
    ) internal {
        address[] memory strategies = tokenStrategies[token];
        if (strategies.length == 0) {
            // No strategies configured, hold funds
            return;
        }
        
        // Calculate total weight
        uint256 totalWeight = 0;
        for (uint256 i = 0; i < strategies.length; i++) {
            totalWeight += strategyWeights[strategies[i]];
        }
        
        if (totalWeight == 0) {
            // Equal distribution if no weights set
            uint256 amountPerStrategy = amount / strategies.length;
            for (uint256 i = 0; i < strategies.length; i++) {
                if (i == strategies.length - 1) {
                    // Last strategy gets remaining amount
                    _executeStrategyDeployment(token, strategies[i], amount - (amountPerStrategy * i));
                } else {
                    _executeStrategyDeployment(token, strategies[i], amountPerStrategy);
                }
            }
        } else {
            // Weighted distribution
            for (uint256 i = 0; i < strategies.length; i++) {
                uint256 strategyAmount = (amount * strategyWeights[strategies[i]]) / totalWeight;
                if (strategyAmount > 0) {
                    _executeStrategyDeployment(token, strategies[i], strategyAmount);
                }
            }
        }
    }
    
    /// @notice Execute strategy deployment
    /// @param token Token to deploy
    /// @param strategy Strategy address
    /// @param amount Amount to deploy
    function _executeStrategyDeployment(
        address token,
        address strategy,
        uint256 amount
    ) internal {
        // Approve strategy to spend tokens
        IERC20(token).safeApprove(strategy, amount);
        
        try IStrategies(strategy).execute(amount, "") {
            totalDeployed[token] += amount;
            emit FundsDeployed(token, strategy, amount);
        } catch {
            // Reset approval on failure
            IERC20(token).safeApprove(strategy, 0);
            revert DeploymentFailed();
        }
    }
    
    /// @notice Check if strategy is valid for token
    /// @param token Token address
    /// @param strategy Strategy address
    /// @return valid Whether strategy is valid
    function _isValidStrategy(address token, address strategy) internal view returns (bool valid) {
        address[] memory strategies = tokenStrategies[token];
        for (uint256 i = 0; i < strategies.length; i++) {
            if (strategies[i] == strategy) {
                return true;
            }
        }
        return false;
    }

    // ============ View Functions ============
    
    /// @notice Get strategy allocation for a token
    /// @param token Token address
    /// @return strategies Array of strategy addresses
    /// @return weights Array of corresponding weights
    function getStrategyAllocation(
        address token
    ) external view returns (address[] memory strategies, uint256[] memory weights) {
        strategies = tokenStrategies[token];
        weights = new uint256[](strategies.length);
        
        for (uint256 i = 0; i < strategies.length; i++) {
            weights[i] = strategyWeights[strategies[i]];
        }
    }
    
    /// @notice Get total balance across all strategies for a token
    /// @param token Token address
    /// @return total Total balance
    function getTotalBalance(address token) external view returns (uint256 total) {
        address[] memory strategies = tokenStrategies[token];
        
        for (uint256 i = 0; i < strategies.length; i++) {
            try IStrategies(strategies[i]).getBalance() returns (uint256 balance) {
                total += balance;
            } catch {
                // Skip failed balance queries
            }
        }
        
        // Add local balance
        total += IERC20(token).balanceOf(address(this));
    }
    
    /// @notice Get supported tokens
    /// @return tokens Array of supported token addresses
    function getSupportedTokens() external view returns (address[] memory) {
        return tokenList;
    }

    // ============ Admin Functions ============
    
    /// @notice Add supported token
    /// @param token Token address to add
    function addSupportedToken(address token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (supportedTokens[token]) return; // Already supported
        
        supportedTokens[token] = true;
        tokenList.push(token);
        
        emit TokenAdded(token);
    }
    
    /// @notice Remove supported token
    /// @param token Token address to remove
    function removeSupportedToken(address token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!supportedTokens[token]) return; // Not supported
        
        supportedTokens[token] = false;
        
        // Remove from array
        for (uint256 i = 0; i < tokenList.length; i++) {
            if (tokenList[i] == token) {
                tokenList[i] = tokenList[tokenList.length - 1];
                tokenList.pop();
                break;
            }
        }
        
        emit TokenRemoved(token);
    }
    
    /// @notice Add strategy for token
    /// @param token Token address
    /// @param strategy Strategy address
    /// @param weight Weight in basis points (10000 = 100%)
    function addStrategy(
        address token,
        address strategy,
        uint256 weight
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!supportedTokens[token]) revert UnsupportedToken();
        if (weight > 10000) revert InvalidWeight();
        
        tokenStrategies[token].push(strategy);
        strategyWeights[strategy] = weight;
        
        emit StrategyAdded(token, strategy, weight);
    }
    
    /// @notice Remove strategy for token
    /// @param token Token address
    /// @param strategy Strategy address
    function removeStrategy(
        address token,
        address strategy
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!supportedTokens[token]) revert UnsupportedToken();
        
        address[] storage strategies = tokenStrategies[token];
        for (uint256 i = 0; i < strategies.length; i++) {
            if (strategies[i] == strategy) {
                strategies[i] = strategies[strategies.length - 1];
                strategies.pop();
                delete strategyWeights[strategy];
                emit StrategyRemoved(token, strategy);
                return;
            }
        }
        
        revert StrategyNotFound();
    }
    
    /// @notice Set emergency pause
    /// @param _paused Pause state
    function setPaused(bool _paused) external onlyRole(DEFAULT_ADMIN_ROLE) {
        paused = _paused;
        emit EmergencyPause(_paused);
    }
}
