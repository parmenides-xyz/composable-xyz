// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/Strategies.sol";

/// @title IDeBridgeGate
/// @notice Interface for deBridge Gate for cross-chain transfers
interface IDeBridgeGate {
    struct SubmissionAutoParams {
        uint256 executionFee;
        uint256 flags;
        bytes fallbackAddress;
        bytes data;
    }
    
    function send(
        address _tokenAddress,
        uint256 _amount,
        uint256 _chainIdTo,
        bytes memory _receiver,
        uint256 _permit,
        bool _useAssetFee,
        uint32 _referralCode,
        bytes calldata _autoParams
    ) external payable;
    
    function getDefiAvaliableReserves(
        address _tokenAddress,
        uint256 _chainId
    ) external view returns (uint256);
}

/// @title Vault Contract
/// @notice This contract implements an ERC4626 vault with role-based access control
/// @dev Extends ERC4626 for vault functionality, Ownable for ownership, and AccessControl for role management
contract Vault is Ownable, ERC4626, AccessControl {
    using SafeERC20 for IERC20;

    // ============ State Variables ============
    /// @notice Role identifier for vault managers
    /// @dev Used in AccessControl for manager permissions
    bytes32 public constant MANAGER_ROLE = keccak256("VAULT_MANAGER_ROLE");

    /// @notice Role identifier for vault agents
    /// @dev Used in AccessControl for agent permissions
    bytes32 public constant AGENT_ROLE = keccak256("VAULT_ADMIN_ROLE");

    /// @notice Role identifier for cross-chain bridge operations
    bytes32 public constant BRIDGE_ROLE = keccak256("VAULT_BRIDGE_ROLE");

    /// @notice Strategies address
    address[] public strategies;

    /// @notice Strategies address
    mapping(address => bool) public isStrategy;
    
    /// @notice deBridge Gate for cross-chain operations
    IDeBridgeGate public deBridgeGate;
    
    /// @notice Target chain IDs for strategy deployment
    mapping(uint256 => bool) public supportedChains;
    uint256[] public chainIds;
    
    /// @notice Cross-chain vault addresses per chain
    mapping(uint256 => address) public crossChainVaults;
    
    /// @notice Tracking cross-chain positions
    mapping(uint256 => uint256) public crossChainDeployments;
    
    /// @notice Bridge fee buffer (in wei)
    uint256 public bridgeFeeBuffer = 0.01 ether;

    // ============ Events ============
    event StrategyAdded(address indexed strategy);
    event StrategyRemoved(address indexed strategy);
    event StrategyExecuted(address indexed strategy, bytes data);
    event StrategyHarvested(address indexed strategy, bytes data);
    event EmergencyExit(address indexed strategy, bytes data);
    event CrossChainDeployment(uint256 indexed chainId, uint256 amount, address targetVault);
    event CrossChainHarvest(uint256 indexed chainId, uint256 amount);
    event BridgeConfigUpdated(address indexed newGate, uint256 newFeeBuffer);
    event ChainAdded(uint256 indexed chainId, address vaultAddress);
    event ChainRemoved(uint256 indexed chainId);

    // ============ Errors ============
    error InvalidStrategy();
    error StrategyAlreadyExists();
    error StrategyDoesNotExist();
    error ExecutionFailed();
    error InvalidAddress();
    error InsufficientBalance();
    error UnsupportedChain();
    error BridgeFailed();
    error InvalidChainId();
    error InsufficientBridgeFee();

    // ============ Modifiers ============
    /// @notice Restricts function access to addresses with MANAGER_ROLE
    /// @dev Reverts if caller doesn't have MANAGER_ROLE
    modifier onlyManager() {
        require(
            hasRole(MANAGER_ROLE, msg.sender),
            "Vault: caller is not a manager"
        );
        _;
    }

    /// @notice Restricts function access to addresses with AGENT_ROLE
    /// @dev Reverts if caller doesn't have AGENT_ROLE
    modifier onlyAgent() {
        require(
            hasRole(AGENT_ROLE, msg.sender),
            "Vault: caller is not an agent"
        );
        _;
    }
    
    /// @notice Restricts function access to addresses with BRIDGE_ROLE
    /// @dev Reverts if caller doesn't have BRIDGE_ROLE
    modifier onlyBridge() {
        require(
            hasRole(BRIDGE_ROLE, msg.sender),
            "Vault: caller is not authorized for bridge operations"
        );
        _;
    }

    // ============ Constructor ============
    /// @notice Initializes the vault with the underlying asset and token details
    /// @dev Sets up initial roles and initializes ERC4626 and ERC20
    /// @param _asset The underlying ERC20 token
    /// @param _name Name of the vault token
    /// @param _symbol Symbol of the vault token
    constructor(
        IERC20 _asset,
        string memory _name,
        string memory _symbol,
        address manager,
        address agent,
        address _deBridgeGate
    ) ERC4626(_asset) ERC20(_name, _symbol) Ownable() {
        require(manager != address(0), "Manager cannot be zero address");
        require(agent != address(0), "Agent cannot be zero address");
        require(_deBridgeGate != address(0), "deBridge gate cannot be zero address");

        // Transfer ownership to the deployer
        _transferOwnership(msg.sender);
        
        deBridgeGate = IDeBridgeGate(_deBridgeGate);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        
        // Set DEFAULT_ADMIN_ROLE as admin for all roles
        _setRoleAdmin(MANAGER_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(AGENT_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(BRIDGE_ROLE, DEFAULT_ADMIN_ROLE);
        
        _grantRole(MANAGER_ROLE, manager);
        _grantRole(AGENT_ROLE, agent);
        _grantRole(BRIDGE_ROLE, agent); // Agent can also bridge
    }

    // ============ External Functions ============
    /**
     * @dev Adds a new strategy to the vault
     * @param strategy The address of the strategy to add
     */
    function addStrategy(address strategy) external onlyManager {
        if (strategy == address(0)) revert InvalidAddress();
        if (isStrategy[strategy]) revert StrategyAlreadyExists();

        isStrategy[strategy] = true;
        strategies.push(strategy);

        emit StrategyAdded(strategy);
    }

    /**
     * @dev Removes a strategy from the vault
     * @param strategy The address of the strategy to remove
     */
    function removeStrategy(address strategy) external onlyManager {
        if (!isStrategy[strategy]) revert StrategyDoesNotExist();

        isStrategy[strategy] = false;

        // Remove from array
        for (uint256 i = 0; i < strategies.length; i++) {
            if (strategies[i] == strategy) {
                strategies[i] = strategies[strategies.length - 1];
                strategies.pop();
                break;
            }
        }

        emit StrategyRemoved(strategy);
    }

    /**
     * @dev Executes a strategy with the given data
     * @param strategy The address of the strategy to execute
     * @param data The data to pass to the strategy
     */
    function executeStrategy(
        address strategy,
        bytes calldata data
    ) external onlyAgent {
        if (!isStrategy[strategy]) revert StrategyDoesNotExist();

        (bool success, ) = strategy.call(data);
        if (!success) revert ExecutionFailed();

        emit StrategyExecuted(strategy, data);
    }

    /**
     * @dev Deposits assets to a strategy and executes it
     * @param strategy The address of the strategy to deposit to
     * @param amount The amount of assets to deposit
     * @param data Additional data for the strategy execution
     */
    function depositToStrategy(
        address strategy,
        uint256 amount,
        bytes calldata data
    ) external onlyAgent {
        if (!isStrategy[strategy]) revert StrategyDoesNotExist();
        if (amount == 0) revert InvalidAddress(); // Reusing error for zero amount

        // Check vault has enough assets
        uint256 vaultBalance = IERC20(asset()).balanceOf(address(this));
        if (vaultBalance < amount) revert InsufficientBalance();

        // Approve strategy to spend vault's tokens
        IERC20(asset()).approve(strategy, amount);

        // Call strategy execute function
        IStrategies(strategy).execute(amount, data);

        emit StrategyExecuted(strategy, data);
    }

    /**
     * @dev Harvests rewards from a strategy
     * @param strategy The address of the strategy to harvest from
     * @param data The data to pass to the strategy
     */
    function harvestStrategy(
        address strategy,
        bytes calldata data
    ) external onlyAgent {
        if (!isStrategy[strategy]) revert StrategyDoesNotExist();

        IStrategies(strategy).harvest(data);

        emit StrategyHarvested(strategy, data);
    }

    /**
     * @dev Performs an emergency exit from a strategy
     * @param strategy The address of the strategy to exit
     * @param data The data to pass to the strategy
     */
    function emergencyExitStrategy(
        address strategy,
        bytes calldata data
    ) external onlyAgent {
        if (!isStrategy[strategy]) revert StrategyDoesNotExist();

        IStrategies(strategy).emergencyExit(data);

        emit EmergencyExit(strategy, data);
    }
    
    // ============ Cross-Chain Functions ============
    
    /**
     * @dev Deploy assets to strategies on another chain
     * @param chainId Target chain ID (1 = Ethereum, 137 = Polygon, etc.)
     * @param amount Amount of assets to bridge and deploy
     * @param strategyData Data for strategy execution on target chain
     */
    function deployToChain(
        uint256 chainId,
        uint256 amount,
        bytes calldata strategyData
    ) external payable onlyBridge {
        if (!supportedChains[chainId]) revert UnsupportedChain();
        if (amount == 0) revert InvalidAddress();
        if (msg.value < bridgeFeeBuffer) revert InsufficientBridgeFee();
        
        address targetVault = crossChainVaults[chainId];
        if (targetVault == address(0)) revert InvalidAddress();
        
        // Check vault has enough assets
        uint256 vaultBalance = IERC20(asset()).balanceOf(address(this));
        if (vaultBalance < amount) revert InsufficientBalance();
        
        // Approve deBridge to spend tokens
        IERC20(asset()).approve(address(deBridgeGate), amount);
        
        try deBridgeGate.send{
            value: msg.value
        }(
            address(asset()),           // token to bridge
            amount,                      // amount
            chainId,                     // target chain
            abi.encodePacked(targetVault), // target vault address
            0,                           // permit (not used)
            false,                       // use asset fee
            0,                           // referral code
            abi.encode(IDeBridgeGate.SubmissionAutoParams({
                executionFee: msg.value / 2,  // Half of sent ETH for execution
                flags: 0,
                fallbackAddress: abi.encodePacked(address(this)),
                data: strategyData            // Strategy execution data
            }))
        ) {
            // Track cross-chain deployment
            crossChainDeployments[chainId] += amount;
            emit CrossChainDeployment(chainId, amount, targetVault);
        } catch {
            // Reset approval on failure
            IERC20(asset()).approve(address(deBridgeGate), 0);
            revert BridgeFailed();
        }
    }
    
    /**
     * @dev Harvest yields from cross-chain strategies
     * @param chainId Source chain ID to harvest from
     * @param expectedAmount Expected amount to receive
     * @param harvestData Data for harvest execution
     */
    function harvestFromChain(
        uint256 chainId,
        uint256 expectedAmount,
        bytes calldata harvestData
    ) external payable onlyBridge {
        if (!supportedChains[chainId]) revert UnsupportedChain();
        if (msg.value < bridgeFeeBuffer) revert InsufficientBridgeFee();
        
        address sourceVault = crossChainVaults[chainId];
        if (sourceVault == address(0)) revert InvalidAddress();
        
        // This would trigger harvest on remote chain
        // Implementation depends on deBridge message passing
        try deBridgeGate.send{
            value: msg.value
        }(
            address(0),                  // ETH (for message only)
            0,                           // no token transfer
            chainId,                     // target chain
            abi.encodePacked(sourceVault), // source vault
            0,                           // permit
            true,                        // use asset fee
            0,                           // referral code
            abi.encode(IDeBridgeGate.SubmissionAutoParams({
                executionFee: msg.value / 2,
                flags: 1,                    // Flag for harvest operation
                fallbackAddress: abi.encodePacked(address(this)),
                data: harvestData
            }))
        ) {
            emit CrossChainHarvest(chainId, expectedAmount);
        } catch {
            revert BridgeFailed();
        }
    }
    
    /**
     * @dev Emergency exit from all cross-chain positions
     */
    function emergencyExitAllChains() external payable onlyBridge {
        for (uint256 i = 0; i < chainIds.length; i++) {
            uint256 chainId = chainIds[i];
            if (crossChainDeployments[chainId] > 0) {
                try this.harvestFromChain{
                    value: bridgeFeeBuffer
                }(chainId, 0, "") {
                    // Emergency harvest initiated
                } catch {
                    // Continue with other chains
                }
            }
        }
    }

    // ============ ERC4626 Functions ============
    /**
     * @dev See {IERC4626-deposit}
     */
    function deposit(
        uint256 assets,
        address receiver
    ) public override returns (uint256) {
        return super.deposit(assets, receiver);
    }

    /**
     * @dev See {IERC4626-mint}
     */
    function mint(
        uint256 shares,
        address receiver
    ) public override returns (uint256) {
        return super.mint(shares, receiver);
    }

    /**
     * @dev See {IERC4626-withdraw}
     */
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public override returns (uint256) {
        return super.withdraw(assets, receiver, owner);
    }

    /**
     * @dev See {IERC4626-redeem}
     */
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public override returns (uint256) {
        return super.redeem(shares, receiver, owner);
    }

    // ============ View Functions ============
    /**
     * @dev Returns whether an address has the manager role
     * @param account The address to check
     * @return bool Whether the address has the manager role
     */
    function hasManagerRole(address account) external view returns (bool) {
        return hasRole(MANAGER_ROLE, account);
    }

    /**
     * @dev Returns whether an address has the agent role
     * @param account The address to check
     * @return bool Whether the address has the agent role
     */
    function hasAgentRole(address account) external view returns (bool) {
        return hasRole(AGENT_ROLE, account);
    }

    /**
     * @dev Returns all strategy addresses
     * @return address[] Array of all strategy addresses
     */
    function getStrategies() external view returns (address[] memory) {
        return strategies;
    }
    
    /**
     * @dev Returns all supported chain IDs
     * @return uint256[] Array of supported chain IDs
     */
    function getSupportedChains() external view returns (uint256[] memory) {
        return chainIds;
    }
    
    /**
     * @dev Get cross-chain deployment amount for a specific chain
     * @param chainId Chain ID to check
     * @return amount Deployed amount on that chain
     */
    function getCrossChainDeployment(uint256 chainId) external view returns (uint256) {
        return crossChainDeployments[chainId];
    }
    
    /**
     * @dev Get total assets including cross-chain deployments
     * @return total Total assets across all chains
     */
    function totalAssets() public view override returns (uint256) {
        uint256 localAssets = IERC20(asset()).balanceOf(address(this));
        uint256 crossChainAssets = 0;
        
        for (uint256 i = 0; i < chainIds.length; i++) {
            crossChainAssets += crossChainDeployments[chainIds[i]];
        }
        
        return localAssets + crossChainAssets;
    }
    
    // ============ Admin Functions ============
    
    /**
     * @dev Add support for a new chain
     * @param chainId Chain ID to add
     * @param vaultAddress Vault address on that chain
     */
    function addSupportedChain(
        uint256 chainId, 
        address vaultAddress
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (chainId == 0) revert InvalidChainId();
        if (vaultAddress == address(0)) revert InvalidAddress();
        if (supportedChains[chainId]) revert StrategyAlreadyExists(); // Reusing error
        
        supportedChains[chainId] = true;
        crossChainVaults[chainId] = vaultAddress;
        chainIds.push(chainId);
        
        emit ChainAdded(chainId, vaultAddress);
    }
    
    /**
     * @dev Remove support for a chain
     * @param chainId Chain ID to remove
     */
    function removeSupportedChain(uint256 chainId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!supportedChains[chainId]) revert StrategyDoesNotExist(); // Reusing error
        
        supportedChains[chainId] = false;
        crossChainVaults[chainId] = address(0);
        
        // Remove from array
        for (uint256 i = 0; i < chainIds.length; i++) {
            if (chainIds[i] == chainId) {
                chainIds[i] = chainIds[chainIds.length - 1];
                chainIds.pop();
                break;
            }
        }
        
        emit ChainRemoved(chainId);
    }
    
    /**
     * @dev Update bridge configuration
     * @param newGate New deBridge gate address
     * @param newFeeBuffer New bridge fee buffer
     */
    function updateBridgeConfig(
        address newGate,
        uint256 newFeeBuffer
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newGate != address(0)) {
            deBridgeGate = IDeBridgeGate(newGate);
        }
        if (newFeeBuffer > 0) {
            bridgeFeeBuffer = newFeeBuffer;
        }
        
        emit BridgeConfigUpdated(newGate, newFeeBuffer);
    }
}
