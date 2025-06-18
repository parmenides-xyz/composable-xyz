"""
AutoDepositProxy monitoring module.
Monitors for USDC deposits and triggers auto-deposit to vault.
"""

import time
import logging
from typing import Dict, Any
from web3 import Web3
from web3.contract import Contract
import os
from dotenv import load_dotenv

# Force load from the correct .env file
load_dotenv('.env', override=True)
logger = logging.getLogger(__name__)

class AutoDepositMonitor:
    """Monitor AutoDepositProxy and trigger deposits automatically."""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.auto_deposit_proxy_address = "0x4A2348aF9F254b5850C2B75AF30d58cDfA19b256"
        self.usdc_address = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
        self.vault_address = "0x670d84987005083dE65C07672241f46dA678D24A"
        
        # Setup Web3
        ethereum_rpc = os.getenv('ETHEREUM_RPC_URL', 
                                 'https://eth-mainnet.g.alchemy.com/v2/exAp0m_LKHnmcM2Uni2BbYH5cLgBYaV2')
        self.w3 = Web3(Web3.HTTPProvider(ethereum_rpc))
        
        # Setup wallet
        self.private_key = os.getenv('PRIV_KEY')
        if not self.private_key:
            raise ValueError("PRIV_KEY required for auto-deposit monitoring")
        
        from eth_account import Account
        logger.info(f"Loading private key (length: {len(self.private_key)})")
        
        try:
            # Try without 0x first (our format)
            self.account = Account.from_key(self.private_key)
            self.wallet_address = self.account.address
            logger.info(f"Monitor wallet: {self.wallet_address}")
        except Exception as e:
            logger.error(f"Failed to load private key: {e}")
            logger.error(f"Key format: {self.private_key[:10]}...")
            raise
        
        # Contract ABIs
        self.usdc_abi = [
            {"name": "balanceOf", "type": "function", "inputs": [{"type": "address"}], "outputs": [{"type": "uint256"}]},
            {"name": "decimals", "type": "function", "inputs": [], "outputs": [{"type": "uint8"}]}
        ]
        
        self.proxy_abi = [
            {"name": "autoDeposit", "type": "function", "inputs": [], "outputs": []},
            {"name": "vault", "type": "function", "inputs": [], "outputs": [{"type": "address"}]},
            {"name": "usdc", "type": "function", "inputs": [], "outputs": [{"type": "address"}]},
            {"name": "beneficiary", "type": "function", "inputs": [], "outputs": [{"type": "address"}]}
        ]
        
        self.vault_abi = [
            {"name": "balanceOf", "type": "function", "inputs": [{"type": "address"}], "outputs": [{"type": "uint256"}]}
        ]
        
        # Setup contracts
        self.usdc_contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(self.usdc_address),
            abi=self.usdc_abi
        )
        
        self.proxy_contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(self.auto_deposit_proxy_address),
            abi=self.proxy_abi
        )
        
        self.vault_contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(self.vault_address),
            abi=self.vault_abi
        )
        
        # Get USDC decimals
        self.usdc_decimals = self.usdc_contract.functions.decimals().call()
        
        logger.info(f"AutoDepositMonitor initialized")
        logger.info(f"  Proxy: {self.auto_deposit_proxy_address}")
        logger.info(f"  USDC: {self.usdc_address}")
        logger.info(f"  Vault: {self.vault_address}")
    
    def check_proxy_balance(self) -> Dict[str, Any]:
        """Check USDC balance in AutoDepositProxy."""
        try:
            balance_raw = self.usdc_contract.functions.balanceOf(self.auto_deposit_proxy_address).call()
            balance_usdc = balance_raw / (10 ** self.usdc_decimals)
            
            return {
                'balance_raw': balance_raw,
                'balance_usdc': balance_usdc,
                'has_balance': balance_raw > 0
            }
        except Exception as e:
            logger.error(f"Error checking proxy balance: {e}")
            return {'balance_raw': 0, 'balance_usdc': 0.0, 'has_balance': False}
    
    def check_user_vault_shares(self, user_address: str) -> Dict[str, Any]:
        """Check user's vault share balance."""
        try:
            shares = self.vault_contract.functions.balanceOf(user_address).call()
            return {
                'shares': shares,
                'shares_formatted': shares / (10 ** 18)  # Assuming 18 decimals for vault shares
            }
        except Exception as e:
            logger.error(f"Error checking vault shares: {e}")
            return {'shares': 0, 'shares_formatted': 0.0}
    
    def trigger_auto_deposit(self) -> bool:
        """Trigger autoDeposit() on the proxy contract."""
        try:
            logger.info("🔄 Triggering auto-deposit...")
            
            # Build transaction
            tx_data = {
                'from': self.wallet_address,
                'gas': 300000,
                'gasPrice': self.w3.eth.gas_price,
                'nonce': self.w3.eth.get_transaction_count(self.wallet_address)
            }
            
            # Build autoDeposit transaction
            tx = self.proxy_contract.functions.autoDeposit().build_transaction(tx_data)
            
            # Sign and send
            signed_txn = self.w3.eth.account.sign_transaction(tx, self.private_key)
            tx_hash = self.w3.eth.send_raw_transaction(signed_txn.raw_transaction)
            
            logger.info(f"📤 AutoDeposit tx sent: {tx_hash.hex()}")
            
            # Wait for confirmation
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=300)
            
            if receipt.status == 1:
                logger.info(f"✅ AutoDeposit confirmed! Gas used: {receipt.gasUsed}")
                return True
            else:
                logger.error(f"❌ AutoDeposit failed: {tx_hash.hex()}")
                return False
                
        except Exception as e:
            logger.error(f"💥 Failed to trigger auto-deposit: {e}")
            return False
    
    def monitor_and_deposit(self, check_interval: int = 30) -> None:
        """Monitor proxy balance and trigger deposits automatically."""
        logger.info(f"🔍 Starting AutoDeposit monitoring (check every {check_interval}s)")
        
        while True:
            try:
                # Check proxy balance
                balance_info = self.check_proxy_balance()
                
                if balance_info['has_balance']:
                    logger.info(f"💰 Found {balance_info['balance_usdc']:.6f} USDC in proxy")
                    
                    # Trigger auto-deposit
                    success = self.trigger_auto_deposit()
                    
                    if success:
                        logger.info("✅ Auto-deposit completed successfully")
                        
                        # Verify the deposit worked
                        time.sleep(5)  # Wait for state to update
                        new_balance = self.check_proxy_balance()
                        if new_balance['balance_usdc'] < balance_info['balance_usdc']:
                            logger.info(f"🎉 USDC successfully deposited to vault!")
                        else:
                            logger.warning("⚠️ USDC still in proxy - deposit may have failed")
                    else:
                        logger.error("❌ Auto-deposit failed")
                
                else:
                    logger.debug(f"💤 No USDC in proxy (balance: {balance_info['balance_usdc']:.6f})")
                
                # Wait before next check
                time.sleep(check_interval)
                
            except KeyboardInterrupt:
                logger.info("🛑 Monitoring stopped by user")
                break
            except Exception as e:
                logger.error(f"💥 Monitoring error: {e}")
                time.sleep(60)  # Wait longer on error
    
    def get_status(self) -> Dict[str, Any]:
        """Get current status of all components."""
        try:
            proxy_balance = self.check_proxy_balance()
            
            # Get proxy config
            proxy_vault = self.proxy_contract.functions.vault().call()
            proxy_usdc = self.proxy_contract.functions.usdc().call()
            proxy_beneficiary = self.proxy_contract.functions.beneficiary().call()
            
            return {
                'proxy_address': self.auto_deposit_proxy_address,
                'proxy_usdc_balance': proxy_balance,
                'proxy_config': {
                    'vault': proxy_vault,
                    'usdc': proxy_usdc,
                    'beneficiary': proxy_beneficiary
                },
                'monitor_wallet': self.wallet_address,
                'ethereum_connected': self.w3.is_connected(),
                'latest_block': self.w3.eth.block_number
            }
        except Exception as e:
            logger.error(f"Error getting status: {e}")
            return {'error': str(e)}

def main():
    """Test the monitor functionality."""
    import sys
    import argparse
    
    parser = argparse.ArgumentParser(description='AutoDeposit Monitor')
    parser.add_argument('--mode', choices=['status', 'monitor', 'trigger'], default='status',
                        help='Mode: status (check status), monitor (continuous), trigger (manual)')
    parser.add_argument('--interval', type=int, default=30,
                        help='Check interval in seconds for monitor mode')
    
    args = parser.parse_args()
    
    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Initialize monitor
    config = {}
    monitor = AutoDepositMonitor(config)
    
    if args.mode == 'status':
        status = monitor.get_status()
        print("🔍 AutoDeposit Monitor Status:")
        print("=" * 30)
        for key, value in status.items():
            print(f"{key}: {value}")
    
    elif args.mode == 'trigger':
        balance = monitor.check_proxy_balance()
        if balance['has_balance']:
            print(f"💰 Found {balance['balance_usdc']:.6f} USDC - triggering deposit...")
            success = monitor.trigger_auto_deposit()
            print("✅ Success!" if success else "❌ Failed!")
        else:
            print("💤 No USDC in proxy to deposit")
    
    elif args.mode == 'monitor':
        monitor.monitor_and_deposit(args.interval)

if __name__ == "__main__":
    main()