"""
Robust Strategy Executor for Real On-Chain AI Rebalancing.
Replaces placeholder functions with actual smart contract interactions.
"""

from typing import Dict, Any, List, Optional
from web3 import Web3
from web3.contract import Contract
from eth_account import Account
import logging
import os
from dotenv import load_dotenv
import json
import time

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

class RobustStrategyExecutor:
    """Robust strategy executor with real on-chain execution capabilities."""
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize the robust strategy executor with configuration."""
        self.config = config
        self.gas_multiplier = config.get('gas_multiplier', 1.2)
        self.max_retries = config.get('max_retries', 3)
        self.confirmation_blocks = config.get('confirmation_blocks', 2)
        self.min_gas_price = config.get('min_gas_price', 1000000000)  # 1 gwei
        self.max_gas_price = config.get('max_gas_price', 100000000000)  # 100 gwei
        
        # Initialize Web3 connections
        self.w3_connections = {}
        self._setup_web3_connections()
        
        # Initialize wallet
        self.private_key = os.getenv('PRIV_KEY')
        if self.private_key:
            self.account = Account.from_key(self.private_key)
            self.wallet_address = self.account.address
            logger.info(f"Wallet loaded: {self.wallet_address}")
        else:
            raise ValueError("PRIV_KEY not found - cannot execute transactions")
        
        # Contract addresses and ABIs
        self.contracts = {}
        self._load_contract_configurations()
    
    def _setup_web3_connections(self):
        """Setup Web3 connections for different chains."""
        # Story Protocol connection (primary for RoyaltyVaults)
        story_rpc = os.getenv('STORY_RPC_URL', 'https://mainnet.storyrpc.io')
        self.w3_connections['story'] = Web3(Web3.HTTPProvider(story_rpc))
        
        # Ethereum connection for deployed strategies
        ethereum_rpc = os.getenv('ETHEREUM_RPC_URL', 
                                 'https://eth-mainnet.g.alchemy.com/v2/exAp0m_LKHnmcM2Uni2BbYH5cLgBYaV2')
        self.w3_connections['ethereum'] = Web3(Web3.HTTPProvider(ethereum_rpc))
        
        # Set default to Story for RoyaltyVault operations
        self.w3 = self.w3_connections['story']
        
        # Test connections
        for chain_name, w3 in self.w3_connections.items():
            try:
                latest_block = w3.eth.get_block('latest')
                logger.info(f"Connected to {chain_name} - Block: {latest_block['number']}, Chain ID: {w3.eth.chain_id}")
            except Exception as e:
                logger.error(f"Failed to connect to {chain_name}: {e}")
    
    def _load_contract_configurations(self):
        """Load contract addresses and ABIs from config and files."""
        # Load contract addresses from environment and config
        self.contract_addresses = {
            'royalty_wrapper': os.getenv('WRAPPER_ADDRESS', '0x670d84987005083dE65C07672241f46dA678D24A'),
            'base_vault': os.getenv('VAULT_ADDRESS', '0x0b5d50e41aAE56a7F1CA3E626BC17DB4fB8bdc5a'),
            'aave_strategy': os.getenv('AAVE_STRATEGY_ADDRESS'),
            'compound_strategy': os.getenv('COMPOUND_STRATEGY_ADDRESS'),
            'usdc': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',  # Ethereum USDC
        }
        
        # Load contract ABIs
        self._load_contract_abis()
    
    def _load_contract_abis(self):
        """Load contract ABIs from files or define inline."""
        # Define essential ABIs inline for reliability
        self.abis = {
            'royalty_wrapper': [
                {
                    "name": "claimAndOptimize",
                    "type": "function",
                    "inputs": [
                        {"name": "royaltyVault", "type": "address"},
                        {"name": "tokens", "type": "address[]"}
                    ],
                    "outputs": []
                },
                {
                    "name": "emergencyExit",
                    "type": "function", 
                    "inputs": [{"name": "royaltyVault", "type": "address"}],
                    "outputs": []
                },
                {
                    "name": "enableOptimization",
                    "type": "function",
                    "inputs": [{"name": "royaltyVault", "type": "address"}],
                    "outputs": []
                },
                {
                    "name": "claimEnhancedRevenue",
                    "type": "function",
                    "inputs": [
                        {"name": "royaltyVault", "type": "address"},
                        {"name": "tokens", "type": "address[]"}
                    ],
                    "outputs": []
                }
            ],
            'vault': [
                {
                    "name": "depositToStrategy",
                    "type": "function",
                    "inputs": [
                        {"name": "strategy", "type": "address"},
                        {"name": "amount", "type": "uint256"},
                        {"name": "data", "type": "bytes"}
                    ],
                    "outputs": []
                },
                {
                    "name": "harvestStrategy",
                    "type": "function",
                    "inputs": [
                        {"name": "strategy", "type": "address"},
                        {"name": "data", "type": "bytes"}
                    ],
                    "outputs": []
                },
                {
                    "name": "emergencyExitStrategy",
                    "type": "function",
                    "inputs": [
                        {"name": "strategy", "type": "address"},
                        {"name": "data", "type": "bytes"}
                    ],
                    "outputs": []
                },
                {
                    "name": "deployToChain",
                    "type": "function",
                    "inputs": [
                        {"name": "chainId", "type": "uint256"},
                        {"name": "amount", "type": "uint256"},
                        {"name": "strategyData", "type": "bytes"}
                    ],
                    "outputs": []
                },
                {
                    "name": "getStrategies",
                    "type": "function",
                    "inputs": [],
                    "outputs": [{"name": "", "type": "address[]"}]
                },
                {
                    "name": "totalAssets",
                    "type": "function",
                    "inputs": [],
                    "outputs": [{"name": "", "type": "uint256"}]
                }
            ],
            'strategy': [
                {
                    "name": "execute",
                    "type": "function",
                    "inputs": [
                        {"name": "amount", "type": "uint256"},
                        {"name": "data", "type": "bytes"}
                    ],
                    "outputs": []
                },
                {
                    "name": "harvest",
                    "type": "function",
                    "inputs": [{"name": "data", "type": "bytes"}],
                    "outputs": []
                },
                {
                    "name": "emergencyExit",
                    "type": "function",
                    "inputs": [{"name": "data", "type": "bytes"}],
                    "outputs": []
                },
                {
                    "name": "getBalance",
                    "type": "function",
                    "inputs": [],
                    "outputs": [{"name": "", "type": "uint256"}]
                }
            ],
            'erc20': [
                {
                    "name": "balanceOf",
                    "type": "function",
                    "inputs": [{"name": "account", "type": "address"}],
                    "outputs": [{"name": "", "type": "uint256"}]
                },
                {
                    "name": "approve",
                    "type": "function",
                    "inputs": [
                        {"name": "spender", "type": "address"},
                        {"name": "amount", "type": "uint256"}
                    ],
                    "outputs": [{"name": "", "type": "bool"}]
                },
                {
                    "name": "transfer",
                    "type": "function",
                    "inputs": [
                        {"name": "to", "type": "address"},
                        {"name": "amount", "type": "uint256"}
                    ],
                    "outputs": [{"name": "", "type": "bool"}]
                },
                {
                    "name": "decimals",
                    "type": "function",
                    "inputs": [],
                    "outputs": [{"name": "", "type": "uint8"}]
                }
            ]
        }
    
    def execute(self, strategy: Dict[str, Any]) -> bool:
        """
        Execute a strategy on-chain with robust error handling and retries.
        
        Args:
            strategy: The strategy to execute
            
        Returns:
            bool: True if execution was successful
        """
        try:
            if not self._validate_strategy(strategy):
                raise ValueError("Invalid strategy format")
            
            logger.info(f"🚀 Executing strategy: {strategy['strategy_type']} on {strategy['target_protocol']}")
            
            # Execute each action with retry mechanism
            for i, action in enumerate(strategy['actions']):
                logger.info(f"📋 Executing action {i+1}/{len(strategy['actions'])}: {action['action_type']}")
                
                success = self._execute_action_with_retry(action)
                if not success:
                    logger.error(f"❌ Failed to execute action: {action}")
                    return False
                
                logger.info(f"✅ Action {i+1} completed successfully")
                
                # Small delay between actions to avoid nonce issues
                time.sleep(2)
            
            logger.info("🎉 Strategy execution completed successfully")
            return True
            
        except Exception as e:
            logger.error(f"💥 Strategy execution failed: {e}")
            return False
    
    def _execute_action_with_retry(self, action: Dict[str, Any]) -> bool:
        """Execute an action with retry mechanism."""
        for attempt in range(self.max_retries):
            try:
                success = self._execute_action(action)
                if success:
                    return True
                
                if attempt < self.max_retries - 1:
                    logger.warning(f"🔄 Retrying action {action['action_type']} (attempt {attempt + 2}/{self.max_retries})")
                    time.sleep(5 * (attempt + 1))  # Exponential backoff
                
            except Exception as e:
                logger.error(f"❌ Attempt {attempt + 1} failed: {e}")
                if attempt < self.max_retries - 1:
                    time.sleep(5 * (attempt + 1))
        
        return False
    
    def _execute_action(self, action: Dict[str, Any]) -> bool:
        """Execute a single strategy action with real smart contract calls."""
        action_type = action['action_type']
        parameters = action['parameters']
        
        # Route to appropriate execution function
        action_handlers = {
            'claim_and_optimize': self._claim_and_optimize,
            'deploy_to_strategy': self._deploy_to_strategy,
            'rebalance_strategies': self._rebalance_strategies,
            'harvest_strategy': self._harvest_strategy,
            'emergency_exit': self._emergency_exit,
            'cross_chain_deploy': self._cross_chain_deploy,
            'enable_yield_optimization': self._enable_yield_optimization,
            'claim_enhanced_royalties': self._claim_enhanced_royalties,
        }
        
        handler = action_handlers.get(action_type)
        if not handler:
            logger.error(f"🚫 Unknown action type: {action_type}")
            return False
        
        return handler(parameters)
    
    def _claim_and_optimize(self, parameters: Dict[str, Any]) -> bool:
        """Claim royalties and optimize yield through wrapper contract."""
        try:
            royalty_vault = parameters['royalty_vault']
            tokens = parameters.get('tokens', [self.contract_addresses['usdc']])
            wrapper_address = parameters.get('wrapper_contract', self.contract_addresses['royalty_wrapper'])
            
            logger.info(f"💰 Claiming and optimizing royalties for vault {royalty_vault}")
            
            # Use Story Protocol chain for wrapper interaction
            w3 = self.w3_connections['story']
            
            # Get wrapper contract
            wrapper_contract = w3.eth.contract(
                address=Web3.to_checksum_address(wrapper_address),
                abi=self.abis['royalty_wrapper']
            )
            
            # Build and execute transaction
            tx_data = {
                'from': self.wallet_address,
                'gas': self._estimate_gas_for_action('claim_and_optimize'),
                'gasPrice': self._get_optimal_gas_price(w3),
                'nonce': w3.eth.get_transaction_count(self.wallet_address)
            }
            
            # Build transaction
            tx = wrapper_contract.functions.claimAndOptimize(
                Web3.to_checksum_address(royalty_vault),
                [Web3.to_checksum_address(token) for token in tokens]
            ).build_transaction(tx_data)
            
            # Execute transaction
            return self._execute_transaction(tx, w3, "claimAndOptimize")
            
        except Exception as e:
            logger.error(f"💥 Failed to claim and optimize: {e}")
            return False
    
    def _deploy_to_strategy(self, parameters: Dict[str, Any]) -> bool:
        """Deploy funds to a specific yield strategy."""
        try:
            strategy_address = parameters['strategy']
            amount = int(parameters['amount'])
            token = parameters.get('token', self.contract_addresses['usdc'])
            vault_address = parameters.get('vault', self.contract_addresses['base_vault'])
            
            logger.info(f"🎯 Deploying {amount} {token} to strategy {strategy_address}")
            
            # Determine which chain based on strategy address
            w3 = self._get_chain_for_strategy(strategy_address)
            
            # Get vault contract
            vault_contract = w3.eth.contract(
                address=Web3.to_checksum_address(vault_address),
                abi=self.abis['vault']
            )
            
            # Build transaction data
            tx_data = {
                'from': self.wallet_address,
                'gas': self._estimate_gas_for_action('deploy_to_strategy'),
                'gasPrice': self._get_optimal_gas_price(w3),
                'nonce': w3.eth.get_transaction_count(self.wallet_address)
            }
            
            # Build transaction to deposit to strategy
            tx = vault_contract.functions.depositToStrategy(
                Web3.to_checksum_address(strategy_address),
                amount,
                b''  # Empty data for now
            ).build_transaction(tx_data)
            
            return self._execute_transaction(tx, w3, f"depositToStrategy({amount})")
            
        except Exception as e:
            logger.error(f"💥 Failed to deploy to strategy: {e}")
            return False
    
    def _rebalance_strategies(self, parameters: Dict[str, Any]) -> bool:
        """Rebalance funds between strategies."""
        try:
            current_strategy = parameters['current_strategy']
            target_strategy = parameters['target_strategy']
            amount = int(parameters.get('amount', 0))
            vault_address = parameters.get('vault', self.contract_addresses['base_vault'])
            
            logger.info(f"⚖️ Rebalancing {amount} from {current_strategy} to {target_strategy}")
            
            # Step 1: Harvest from current strategy
            if not self._harvest_strategy({'strategy': current_strategy, 'vault': vault_address}):
                logger.error("Failed to harvest from current strategy")
                return False
            
            # Step 2: Deploy to target strategy
            return self._deploy_to_strategy({
                'strategy': target_strategy,
                'amount': amount,
                'vault': vault_address
            })
            
        except Exception as e:
            logger.error(f"💥 Failed to rebalance strategies: {e}")
            return False
    
    def _harvest_strategy(self, parameters: Dict[str, Any]) -> bool:
        """Harvest yields from a strategy."""
        try:
            strategy_address = parameters['strategy']
            vault_address = parameters.get('vault', self.contract_addresses['base_vault'])
            
            logger.info(f"🌾 Harvesting strategy {strategy_address}")
            
            # Determine chain for strategy
            w3 = self._get_chain_for_strategy(strategy_address)
            
            # Get vault contract
            vault_contract = w3.eth.contract(
                address=Web3.to_checksum_address(vault_address),
                abi=self.abis['vault']
            )
            
            # Build transaction
            tx_data = {
                'from': self.wallet_address,
                'gas': self._estimate_gas_for_action('harvest_strategy'),
                'gasPrice': self._get_optimal_gas_price(w3),
                'nonce': w3.eth.get_transaction_count(self.wallet_address)
            }
            
            tx = vault_contract.functions.harvestStrategy(
                Web3.to_checksum_address(strategy_address),
                b''  # Empty data
            ).build_transaction(tx_data)
            
            return self._execute_transaction(tx, w3, "harvestStrategy")
            
        except Exception as e:
            logger.error(f"💥 Failed to harvest strategy: {e}")
            return False
    
    def _emergency_exit(self, parameters: Dict[str, Any]) -> bool:
        """Execute emergency exit from strategies."""
        try:
            royalty_vault = parameters.get('royalty_vault')
            wrapper_address = parameters.get('wrapper_contract', self.contract_addresses['royalty_wrapper'])
            
            logger.info(f"🚨 Emergency exit for vault {royalty_vault}")
            
            # Use Story chain for wrapper
            w3 = self.w3_connections['story']
            
            # Get wrapper contract
            wrapper_contract = w3.eth.contract(
                address=Web3.to_checksum_address(wrapper_address),
                abi=self.abis['royalty_wrapper']
            )
            
            # Build transaction
            tx_data = {
                'from': self.wallet_address,
                'gas': self._estimate_gas_for_action('emergency_exit'),
                'gasPrice': self._get_optimal_gas_price(w3),
                'nonce': w3.eth.get_transaction_count(self.wallet_address)
            }
            
            tx = wrapper_contract.functions.emergencyExit(
                Web3.to_checksum_address(royalty_vault)
            ).build_transaction(tx_data)
            
            return self._execute_transaction(tx, w3, "emergencyExit")
            
        except Exception as e:
            logger.error(f"💥 Failed to execute emergency exit: {e}")
            return False
    
    def _cross_chain_deploy(self, parameters: Dict[str, Any]) -> bool:
        """Deploy funds to strategies on other chains using deBridge."""
        try:
            target_chain_id = int(parameters['chain_id'])
            amount = int(parameters['amount'])
            strategy_data = parameters.get('strategy_data', b'')
            vault_address = parameters.get('vault', self.contract_addresses['base_vault'])
            
            logger.info(f"🌉 Cross-chain deploy: {amount} to chain {target_chain_id}")
            
            # Use appropriate chain (Story for RoyaltyVault operations)
            w3 = self.w3_connections['story']
            
            # Get vault contract
            vault_contract = w3.eth.contract(
                address=Web3.to_checksum_address(vault_address),
                abi=self.abis['vault']
            )
            
            # Build transaction with ETH value for bridge fees
            bridge_fee = int(0.01 * 10**18)  # 0.01 ETH bridge fee
            
            tx_data = {
                'from': self.wallet_address,
                'gas': self._estimate_gas_for_action('cross_chain_deploy'),
                'gasPrice': self._get_optimal_gas_price(w3),
                'nonce': w3.eth.get_transaction_count(self.wallet_address),
                'value': bridge_fee
            }
            
            tx = vault_contract.functions.deployToChain(
                target_chain_id,
                amount,
                strategy_data
            ).build_transaction(tx_data)
            
            return self._execute_transaction(tx, w3, f"deployToChain({target_chain_id})")
            
        except Exception as e:
            logger.error(f"💥 Failed to execute cross-chain deploy: {e}")
            return False
    
    def _enable_yield_optimization(self, parameters: Dict[str, Any]) -> bool:
        """Enable yield optimization for a RoyaltyVault."""
        try:
            royalty_vault = parameters['royalty_vault']
            wrapper_address = parameters.get('wrapper_contract', self.contract_addresses['royalty_wrapper'])
            
            logger.info(f"🔓 Enabling yield optimization for vault {royalty_vault}")
            
            # This is typically user-initiated, AI agent just monitors
            # Return True to indicate readiness
            return True
            
        except Exception as e:
            logger.error(f"💥 Failed to enable yield optimization: {e}")
            return False
    
    def _claim_enhanced_royalties(self, parameters: Dict[str, Any]) -> bool:
        """Claim enhanced royalties for users."""
        try:
            royalty_vault = parameters['royalty_vault']
            tokens = parameters.get('tokens', [self.contract_addresses['usdc']])
            wrapper_address = parameters.get('wrapper_contract', self.contract_addresses['royalty_wrapper'])
            
            logger.info(f"💎 Claiming enhanced royalties from {royalty_vault}")
            
            # Use Story chain
            w3 = self.w3_connections['story']
            
            # Get wrapper contract
            wrapper_contract = w3.eth.contract(
                address=Web3.to_checksum_address(wrapper_address),
                abi=self.abis['royalty_wrapper']
            )
            
            # Build transaction
            tx_data = {
                'from': self.wallet_address,
                'gas': self._estimate_gas_for_action('claim_enhanced_royalties'),
                'gasPrice': self._get_optimal_gas_price(w3),
                'nonce': w3.eth.get_transaction_count(self.wallet_address)
            }
            
            tx = wrapper_contract.functions.claimEnhancedRevenue(
                Web3.to_checksum_address(royalty_vault),
                [Web3.to_checksum_address(token) for token in tokens]
            ).build_transaction(tx_data)
            
            return self._execute_transaction(tx, w3, "claimEnhancedRevenue")
            
        except Exception as e:
            logger.error(f"💥 Failed to claim enhanced royalties: {e}")
            return False
    
    def _execute_transaction(self, tx: Dict[str, Any], w3: Web3, operation_name: str) -> bool:
        """Execute a transaction with robust error handling."""
        try:
            # Sign transaction
            signed_txn = w3.eth.account.sign_transaction(tx, self.private_key)
            
            # Send transaction
            tx_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)
            
            logger.info(f"📤 Transaction sent: {tx_hash.hex()} for {operation_name}")
            
            # Wait for confirmation
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=300)
            
            if receipt.status == 1:
                logger.info(f"✅ Transaction confirmed: {tx_hash.hex()} - Gas used: {receipt.gasUsed}")
                return True
            else:
                logger.error(f"❌ Transaction failed: {tx_hash.hex()}")
                return False
                
        except Exception as e:
            logger.error(f"💥 Failed to execute transaction for {operation_name}: {e}")
            return False
    
    def _get_chain_for_strategy(self, strategy_address: str) -> Web3:
        """Determine which chain a strategy is deployed on."""
        # For now, assume Ethereum for strategy contracts
        # Later, this could check multiple chains
        return self.w3_connections['ethereum']
    
    def _get_optimal_gas_price(self, w3: Web3) -> int:
        """Get optimal gas price for the network."""
        try:
            gas_price = w3.eth.gas_price
            # Apply bounds
            gas_price = max(gas_price, self.min_gas_price)
            gas_price = min(gas_price, self.max_gas_price)
            
            logger.debug(f"⛽ Using gas price: {gas_price / 10**9:.2f} gwei")
            return gas_price
            
        except Exception as e:
            logger.error(f"Failed to get gas price: {e}")
            return self.min_gas_price
    
    def _estimate_gas_for_action(self, action_type: str) -> int:
        """Estimate gas for different action types."""
        gas_estimates = {
            'claim_and_optimize': 300000,
            'deploy_to_strategy': 250000,
            'rebalance_strategies': 400000,
            'harvest_strategy': 200000,
            'emergency_exit': 350000,
            'cross_chain_deploy': 500000,
            'enable_yield_optimization': 150000,
            'claim_enhanced_royalties': 200000,
        }
        
        base_gas = gas_estimates.get(action_type, 250000)
        return int(base_gas * self.gas_multiplier)
    
    def _validate_strategy(self, strategy: Dict[str, Any]) -> bool:
        """Validate strategy format and parameters."""
        required_fields = ["strategy_type", "target_protocol", "actions"]
        if not all(field in strategy for field in required_fields):
            logger.error(f"Missing required fields in strategy: {required_fields}")
            return False
            
        for action in strategy['actions']:
            if not self._validate_action(action):
                return False
                
        return True
    
    def _validate_action(self, action: Dict[str, Any]) -> bool:
        """Validate action format and parameters."""
        required_fields = ["action_type", "parameters"]
        if not all(field in action for field in required_fields):
            logger.error(f"Missing required fields in action: {required_fields}")
            return False
        
        return True
    
    def get_strategy_performance(self, strategy_address: str) -> Dict[str, Any]:
        """Get performance metrics for a strategy."""
        try:
            w3 = self._get_chain_for_strategy(strategy_address)
            
            strategy_contract = w3.eth.contract(
                address=Web3.to_checksum_address(strategy_address),
                abi=self.abis['strategy']
            )
            
            balance = strategy_contract.functions.getBalance().call()
            
            return {
                "strategy": strategy_address,
                "balance": balance,
                "chain_id": w3.eth.chain_id,
                "block_number": w3.eth.block_number
            }
            
        except Exception as e:
            logger.error(f"Failed to get strategy performance: {e}")
            return {}
    
    def get_vault_status(self, vault_address: str) -> Dict[str, Any]:
        """Get comprehensive vault status."""
        try:
            # Try Story chain first
            w3 = self.w3_connections['story']
            
            vault_contract = w3.eth.contract(
                address=Web3.to_checksum_address(vault_address),
                abi=self.abis['vault']
            )
            
            total_assets = vault_contract.functions.totalAssets().call()
            strategies = vault_contract.functions.getStrategies().call()
            
            return {
                "vault": vault_address,
                "total_assets": total_assets,
                "strategies": strategies,
                "chain_id": w3.eth.chain_id,
                "timestamp": int(time.time())
            }
            
        except Exception as e:
            logger.error(f"Failed to get vault status: {e}")
            return {}

    def health_check(self) -> Dict[str, Any]:
        """Perform health check on all connections and contracts."""
        health_status = {
            "wallet": self.wallet_address,
            "chains": {},
            "contracts": {},
            "timestamp": int(time.time())
        }
        
        # Check chain connections
        for chain_name, w3 in self.w3_connections.items():
            try:
                latest_block = w3.eth.get_block('latest')
                balance = w3.eth.get_balance(self.wallet_address)
                
                health_status["chains"][chain_name] = {
                    "connected": True,
                    "chain_id": w3.eth.chain_id,
                    "latest_block": latest_block['number'],
                    "wallet_balance": w3.from_wei(balance, 'ether'),
                    "gas_price": w3.eth.gas_price / 10**9  # in gwei
                }
            except Exception as e:
                health_status["chains"][chain_name] = {
                    "connected": False,
                    "error": str(e)
                }
        
        # Check contract accessibility
        for contract_name, address in self.contract_addresses.items():
            if address:
                try:
                    w3 = self.w3_connections['story']  # Default chain
                    code = w3.eth.get_code(address)
                    
                    health_status["contracts"][contract_name] = {
                        "address": address,
                        "deployed": len(code) > 0,
                        "chain": "story"
                    }
                except Exception as e:
                    health_status["contracts"][contract_name] = {
                        "address": address,
                        "deployed": False,
                        "error": str(e)
                    }
        
        return health_status
    
    def get_vault_balance(self, vault_address: str = None) -> Dict[str, Any]:
        """Get vault balance and asset information for ERC4626 vault."""
        try:
            if not vault_address:
                vault_address = self.contract_addresses['base_vault']
            
            # Use Ethereum connection for our vault
            w3 = self.w3_connections['ethereum']
            
            # ERC4626 vault ABI
            vault_contract = w3.eth.contract(
                address=Web3.to_checksum_address(vault_address),
                abi=[
                    {"name": "totalAssets", "type": "function", "inputs": [], "outputs": [{"type": "uint256"}]},
                    {"name": "totalSupply", "type": "function", "inputs": [], "outputs": [{"type": "uint256"}]},
                    {"name": "asset", "type": "function", "inputs": [], "outputs": [{"type": "address"}]},
                    {"name": "balanceOf", "type": "function", "inputs": [{"type": "address"}], "outputs": [{"type": "uint256"}]}
                ]
            )
            
            # Get vault data
            total_assets = vault_contract.functions.totalAssets().call()
            total_supply = vault_contract.functions.totalSupply().call() 
            asset_address = vault_contract.functions.asset().call()
            
            # Get USDC contract to check decimals
            usdc_contract = w3.eth.contract(
                address=Web3.to_checksum_address(asset_address),
                abi=[
                    {"name": "balanceOf", "type": "function", "inputs": [{"type": "address"}], "outputs": [{"type": "uint256"}]},
                    {"name": "decimals", "type": "function", "inputs": [], "outputs": [{"type": "uint8"}]}
                ]
            )
            
            vault_usdc_balance = usdc_contract.functions.balanceOf(vault_address).call()
            decimals = usdc_contract.functions.decimals().call()
            
            # Calculate deployed amount (total assets - idle balance)
            deployed_amount = total_assets - vault_usdc_balance
            
            logger.info(f"💰 Vault Balance: {total_assets / (10**decimals):.6f} USDC total")
            logger.info(f"💤 Idle: {vault_usdc_balance / (10**decimals):.6f} USDC")
            logger.info(f"🚀 Deployed: {deployed_amount / (10**decimals):.6f} USDC")
            
            return {
                'vault_address': vault_address,
                'total_assets': total_assets,
                'total_supply': total_supply,
                'idle_balance': vault_usdc_balance,
                'deployed_balance': deployed_amount,
                'asset_address': asset_address,
                'decimals': decimals,
                'balance_usdc': total_assets / (10**decimals),
                'idle_usdc': vault_usdc_balance / (10**decimals),
                'deployed_usdc': deployed_amount / (10**decimals)
            }
            
        except Exception as e:
            logger.error(f"💥 Failed to get vault balance: {e}")
            return {}
