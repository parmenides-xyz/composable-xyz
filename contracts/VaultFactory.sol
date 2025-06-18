// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./Vault.sol";

/// @title VaultFactory Contract
/// @notice Factory contract for creating and managing Vault instances
/// @dev Implements access control for vault creation and management
contract VaultFactory is Ownable {
    using SafeERC20 for IERC20;
    // ============ State Variables ============

    /// @notice Counter for vault IDs
    uint256 public vaultCounter;

    /// @notice Mapping from vault ID to vault address
    mapping(uint256 => address) public vaults;

    /// @notice Default manager for new vaults
    address public defaultManager;

    /// @notice Default agent for new vaults
    address public defaultAgent;

    /// @notice Fee for creating a vault (in wei)
    uint256 public creationFee;

    /// @notice Treasury address to receive fees
    address public treasury;

    // ============ Structs ============

    /// @notice Struct containing vault creation parameters
    struct VaultParams {
        IERC20 asset;
        string name;
        string symbol;
        address manager;
        address agent;
    }

    // ============ Events ============

    event VaultCreated(
        uint256 indexed vaultId,
        address indexed vaultAddress,
        address indexed asset,
        address creator
    );

    // ============ Errors ============

    error InvalidAsset();
    error InsufficientFee();

    // ============ Constructor ============

    constructor(
        address _defaultManager,
        address _defaultAgent,
        address _treasury,
        uint256 _creationFee
    ) Ownable() {
        defaultManager = _defaultManager;
        defaultAgent = _defaultAgent;
        treasury = _treasury;
        creationFee = _creationFee;
    }

    // ============ External Functions ============

    function createVault(
        VaultParams calldata params
    ) external payable returns (address vaultAddress, uint256 vaultId) {
        if (address(params.asset) == address(0)) revert InvalidAsset();
        if (msg.value < creationFee) revert InsufficientFee();

        address manager = params.manager != address(0) ? params.manager : defaultManager;
        address agent = params.agent != address(0) ? params.agent : defaultAgent;

        vaultCounter++;
        vaultId = vaultCounter;

        Vault vault = new Vault(
            params.asset,
            params.name,
            params.symbol,
            manager,
            agent,
            0x43dE2d77BF8027e25dBD179B491e8d64f38398aA
        );

        vaultAddress = address(vault);
        vaults[vaultId] = vaultAddress;

        if (msg.value > 0) {
            (bool success, ) = treasury.call{value: msg.value}("");
            require(success, "Transfer failed");
        }

        emit VaultCreated(vaultId, vaultAddress, address(params.asset), msg.sender);
        return (vaultAddress, vaultId);
    }

    function getVaultCount() external view returns (uint256) {
        return vaultCounter;
    }
}
