"""
Vault Connection Manager for RoyaltyVault user connections.
Handles user vault token connections, validation, and authorization.
"""

import logging
import time
from typing import Dict, Any, List, Optional
from web3 import Web3
from eth_account import Account

logger = logging.getLogger(__name__)

class VaultConnectionManager:
    """Manages user connections to RoyaltyVaults for yield optimization."""
    
    def __init__(self, w3: Web3, wrapper_address: str):
        """
        Initialize the vault connection manager.
        
        Args:
            w3: Web3 instance for blockchain interactions
            wrapper_address: Address of the RoyaltyYieldWrapper contract
        """
        self.w3 = w3
        self.wrapper_address = wrapper_address
        self.connected_vaults: Dict[str, List[Dict[str, Any]]] = {}  # user_address -> vault_list
        
        # ERC20 ABI for basic token operations
        self.erc20_abi = [
            {
                "name": "balanceOf",
                "type": "function",
                "stateMutability": "view",
                "inputs": [{"name": "account", "type": "address"}],
                "outputs": [{"name": "", "type": "uint256"}]
            },
            {
                "name": "name",
                "type": "function",
                "stateMutability": "view",
                "inputs": [],
                "outputs": [{"name": "", "type": "string"}]
            },
            {
                "name": "symbol",
                "type": "function",
                "stateMutability": "view",
                "inputs": [],
                "outputs": [{"name": "", "type": "string"}]
            },
            {
                "name": "totalSupply",
                "type": "function",
                "stateMutability": "view",
                "inputs": [],
                "outputs": [{"name": "", "type": "uint256"}]
            }
        ]
    
    def validate_royalty_vault(self, vault_token_address: str) -> Dict[str, Any]:
        """
        Validate that a token address is a valid RoyaltyVault.
        
        Args:
            vault_token_address: The ERC20 address to validate
            
        Returns:
            Dict with validation results and vault info
        """
        try:
            # Check if contract exists
            code = self.w3.eth.get_code(vault_token_address)
            if code == b'':
                return {
                    "valid": False,
                    "error": "Contract not found at address"
                }
            
            # Create contract instance
            contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(vault_token_address),
                abi=self.erc20_abi
            )
            
            # Try to get basic ERC20 info
            try:
                name = contract.functions.name().call()
                symbol = contract.functions.symbol().call()
                total_supply = contract.functions.totalSupply().call()
                
                # Basic validation: RoyaltyVault tokens typically have specific naming patterns
                is_likely_royalty = any(keyword in name.lower() for keyword in [
                    'royalty', 'vault', 'ip', 'story'
                ])
                
                return {
                    "valid": True,
                    "vault_info": {
                        "name": name,
                        "symbol": symbol,
                        "total_supply": total_supply,
                        "is_likely_royalty": is_likely_royalty
                    }
                }
                
            except Exception as e:
                return {
                    "valid": False,
                    "error": f"Failed to read contract data: {e}"
                }
                
        except Exception as e:
            logger.error(f"Error validating vault {vault_token_address}: {e}")
            return {
                "valid": False,
                "error": str(e)
            }
    
    def check_user_ownership(self, vault_token_address: str, user_address: str) -> Dict[str, Any]:
        """
        Check if user owns tokens in the RoyaltyVault.
        
        Args:
            vault_token_address: The RoyaltyVault token address
            user_address: The user's wallet address
            
        Returns:
            Dict with ownership info
        """
        try:
            contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(vault_token_address),
                abi=self.erc20_abi
            )
            
            balance = contract.functions.balanceOf(
                Web3.to_checksum_address(user_address)
            ).call()
            
            total_supply = contract.functions.totalSupply().call()
            
            ownership_percentage = (balance / total_supply * 100) if total_supply > 0 else 0
            
            return {
                "owns_tokens": balance > 0,
                "balance": balance,
                "balance_formatted": balance / 1e18,  # Assume 18 decimals for display
                "total_supply": total_supply,
                "ownership_percentage": ownership_percentage
            }
            
        except Exception as e:
            logger.error(f"Error checking ownership for {user_address} in {vault_token_address}: {e}")
            return {
                "owns_tokens": False,
                "balance": 0,
                "error": str(e)
            }
    
    def connect_vault(self, vault_token_address: str, user_address: str, metadata: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Connect a user's RoyaltyVault for optimization.
        
        Args:
            vault_token_address: The RoyaltyVault token address
            user_address: The user's wallet address
            metadata: Optional metadata about the vault
            
        Returns:
            Dict with connection result
        """
        try:
            logger.info(f"Connecting vault {vault_token_address} for user {user_address}")
            
            # 1. Validate vault
            validation = self.validate_royalty_vault(vault_token_address)
            if not validation["valid"]:
                return {
                    "success": False,
                    "error": f"Invalid vault: {validation['error']}"
                }
            
            # 2. Check user ownership
            ownership = self.check_user_ownership(vault_token_address, user_address)
            if not ownership["owns_tokens"]:
                return {
                    "success": False,
                    "error": "User does not own tokens in this vault"
                }
            
            # 3. Create connection record
            connection_info = {
                "vault_address": vault_token_address,
                "user_address": user_address,
                "connected_at": time.time(),
                "user_balance": ownership["balance"],
                "ownership_percentage": ownership["ownership_percentage"],
                "vault_info": validation["vault_info"],
                "optimization_enabled": True,
                "last_optimized": None,
                "metadata": metadata or {}
            }
            
            # 4. Add to connections
            if user_address not in self.connected_vaults:
                self.connected_vaults[user_address] = []
            
            # Check if already connected
            existing = next((v for v in self.connected_vaults[user_address] 
                           if v["vault_address"] == vault_token_address), None)
            
            if existing:
                # Update existing connection
                existing.update(connection_info)
                logger.info(f"Updated existing connection for vault {vault_token_address}")
            else:
                # Add new connection
                self.connected_vaults[user_address].append(connection_info)
                logger.info(f"Added new connection for vault {vault_token_address}")
            
            return {
                "success": True,
                "connection_info": connection_info
            }
            
        except Exception as e:
            logger.error(f"Error connecting vault: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def disconnect_vault(self, vault_token_address: str, user_address: str) -> Dict[str, Any]:
        """
        Disconnect a user's RoyaltyVault from optimization.
        
        Args:
            vault_token_address: The RoyaltyVault token address
            user_address: The user's wallet address
            
        Returns:
            Dict with disconnection result
        """
        try:
            if user_address not in self.connected_vaults:
                return {
                    "success": False,
                    "error": "User has no connected vaults"
                }
            
            # Find and remove the vault
            original_count = len(self.connected_vaults[user_address])
            self.connected_vaults[user_address] = [
                v for v in self.connected_vaults[user_address]
                if v["vault_address"] != vault_token_address
            ]
            
            removed = len(self.connected_vaults[user_address]) < original_count
            
            if removed:
                logger.info(f"Disconnected vault {vault_token_address} for user {user_address}")
                return {"success": True}
            else:
                return {
                    "success": False,
                    "error": "Vault was not connected"
                }
                
        except Exception as e:
            logger.error(f"Error disconnecting vault: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_user_vaults(self, user_address: str) -> List[Dict[str, Any]]:
        """
        Get all connected vaults for a user.
        
        Args:
            user_address: The user's wallet address
            
        Returns:
            List of connected vault information
        """
        return self.connected_vaults.get(user_address, []).copy()
    
    def get_all_connected_vaults(self) -> List[Dict[str, Any]]:
        """
        Get all connected vaults across all users.
        
        Returns:
            List of all connected vault information
        """
        all_vaults = []
        for user_vaults in self.connected_vaults.values():
            all_vaults.extend(user_vaults)
        return all_vaults
    
    def update_vault_status(self, vault_token_address: str, user_address: str, 
                           status_updates: Dict[str, Any]) -> bool:
        """
        Update status information for a connected vault.
        
        Args:
            vault_token_address: The RoyaltyVault token address
            user_address: The user's wallet address
            status_updates: Dict of fields to update
            
        Returns:
            bool: Success status
        """
        try:
            if user_address not in self.connected_vaults:
                return False
            
            vault = next((v for v in self.connected_vaults[user_address] 
                         if v["vault_address"] == vault_token_address), None)
            
            if vault:
                vault.update(status_updates)
                logger.debug(f"Updated vault {vault_token_address} status: {status_updates}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error updating vault status: {e}")
            return False
    
    def get_optimization_candidates(self) -> List[Dict[str, Any]]:
        """
        Get vaults that are candidates for optimization.
        
        Returns:
            List of vaults ready for optimization
        """
        candidates = []
        current_time = time.time()
        
        for vault in self.get_all_connected_vaults():
            # Check if optimization is enabled
            if not vault.get("optimization_enabled", True):
                continue
            
            # Check minimum time between optimizations (1 hour)
            last_optimized = vault.get("last_optimized")
            if last_optimized and (current_time - last_optimized) < 3600:
                continue
            
            candidates.append(vault)
        
        return candidates
    
    def get_connection_stats(self) -> Dict[str, Any]:
        """
        Get statistics about connected vaults.
        
        Returns:
            Dict with connection statistics
        """
        all_vaults = self.get_all_connected_vaults()
        
        return {
            "total_users": len(self.connected_vaults),
            "total_vaults": len(all_vaults),
            "optimization_enabled": sum(1 for v in all_vaults if v.get("optimization_enabled", True)),
            "recently_optimized": sum(1 for v in all_vaults 
                                    if v.get("last_optimized") and 
                                    (time.time() - v["last_optimized"]) < 86400),  # 24 hours
            "awaiting_optimization": len(self.get_optimization_candidates())
        }
