// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./Vault.sol";

/// @title AutoDepositProxy
/// @notice A proxy contract that automatically deposits received USDC into a vault
/// @dev This allows deBridge to send USDC directly to this contract, which auto-deposits to vault
contract AutoDepositProxy {
    using SafeERC20 for IERC20;
    
    /// @notice The target vault for deposits
    Vault public immutable vault;
    
    /// @notice The USDC token
    IERC20 public immutable usdc;
    
    /// @notice Address that should receive the vault shares
    address public immutable beneficiary;
    
    event AutoDeposit(address indexed beneficiary, uint256 usdcAmount, uint256 sharesReceived);
    
    constructor(address _vault, address _usdc, address _beneficiary) {
        vault = Vault(_vault);
        usdc = IERC20(_usdc);
        beneficiary = _beneficiary;
        
        // Pre-approve vault to save gas on deposits
        usdc.safeApprove(_vault, type(uint256).max);
    }
    
    /// @notice Automatically deposit any USDC balance to vault
    /// @dev Can be called by anyone, sends vault shares to beneficiary
    function autoDeposit() external {
        uint256 balance = usdc.balanceOf(address(this));
        if (balance > 0) {
            uint256 shares = vault.deposit(balance, beneficiary);
            emit AutoDeposit(beneficiary, balance, shares);
        }
    }
    
    /// @notice Fallback function that triggers auto-deposit when USDC is received
    /// @dev This allows the contract to automatically deposit when USDC arrives from bridge
    fallback() external {
        // Only auto-deposit if we have USDC balance
        uint256 balance = usdc.balanceOf(address(this));
        if (balance > 0) {
            uint256 shares = vault.deposit(balance, beneficiary);
            emit AutoDeposit(beneficiary, balance, shares);
        }
    }
}