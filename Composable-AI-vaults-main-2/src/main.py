"""
Main orchestration module for the Composable RoyaltyVault Yield Optimizer.
Optimizes OUR deployed ERC4626 vault that receives bridged USDC from Story Protocol royalties.
"""

import yaml
import logging
import time
import os
from pathlib import Path
from typing import Dict, Any, List
from dotenv import load_dotenv

# Force load production environment variables FIRST
load_dotenv('.env', override=True)

from agent.llm_planner import LLMPlanner
from agent.risk_model import RiskModel
from agent.knowledge_box import KnowledgeBox
from execution.strategy_executor_robust import RobustStrategyExecutor
from data_providers.defillama_provider import DeFiLlamaProvider
from data_providers.aave_v3 import AaveV3Provider
from data_providers.compound_v3 import CompoundV3Provider

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ComposableYieldOptimizer:
    """
    Composable Yield Optimizer for our deployed ERC4626 vault.
    
    Architecture:
    Story RoyaltyVault → Extract royalties → deBridge → Our ERC4626 Vault → Composable Strategies
    """
    
    def __init__(self, config_path: str = "configs/config.yaml"):
        """Initialize the Composable Yield Optimizer with configuration and components."""
        self.config = self._load_config(config_path)
        
        # Initialize AI components
        self.llm_planner = LLMPlanner(self.config['llm'])
        self.risk_model = RiskModel()
        self.knowledge_box = KnowledgeBox()
        self.strategy_executor = RobustStrategyExecutor(self.config['execution'])
        
        # Initialize data providers for yield opportunities
        self.data_providers = {
            'defillama': DeFiLlamaProvider(self.config['providers']['defillama']),
            'aave': AaveV3Provider(self.config['protocols']['aave']),
            'compound': CompoundV3Provider(self.config['protocols'].get('compound', {}))
        }
        
        # Initialize vault connection manager for user RoyaltyVault connections
        from vault_manager import VaultConnectionManager
        
        # Get Story Protocol config (use story_mainnet for production)
        story_config = self.config['story_protocol'].get('story_mainnet', {})
        wrapper_address = story_config.get('wrapper_address', '')
        
        self.vault_manager = VaultConnectionManager(
            w3=self.strategy_executor.w3,
            wrapper_address=wrapper_address
        )
        
        # Get our deployed vault address (the ERC4626 vault we optimize)
        self.our_vault_address = story_config.get('base_vault', '')
        self.wrapper_address = wrapper_address
        
        # Configuration
        self.optimization_interval = self.config.get('optimization', {}).get('interval', 3600)
        self.min_yield_threshold = self.config['risk']['min_apr_threshold']
        self.min_balance_threshold = self.config['optimization']['min_balance_threshold']
        
        logger.info(f"Initialized Composable Optimizer for vault: {self.our_vault_address}")
        logger.info(f"Ready to accept user RoyaltyVault connections")

    def _load_config(self, config_path: str) -> Dict[str, Any]:
        """Load configuration from YAML file."""
        try:
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)
                logger.info(f"Loaded configuration from {config_path}")
                return config
        except FileNotFoundError:
            logger.error(f"Configuration file not found: {config_path}")
            # Try to find config file in common locations
            possible_paths = [
                os.path.join(os.path.dirname(__file__), "..", "configs", "config.yaml"),
                os.path.join(os.getcwd(), "configs", "config.yaml"),
                "../configs/config.yaml",
                "config.yaml"
            ]
            
            for path in possible_paths:
                if os.path.exists(path):
                    logger.info(f"Found config at {path}")
                    with open(path, 'r') as f:
                        return yaml.safe_load(f)
            
            raise FileNotFoundError(f"Could not find config.yaml in any of: {possible_paths}")

    def connect_user_vault(self, vault_token_address: str, user_address: str) -> bool:
        """Connect a user's RoyaltyVault for optimization."""
        result = self.vault_manager.connect_vault(vault_token_address, user_address)
        if result["success"]:
            logger.info(f"✅ Connected RoyaltyVault {vault_token_address} for user {user_address}")
        else:
            logger.error(f"❌ Failed to connect vault: {result['error']}")
        return result["success"]

    def disconnect_user_vault(self, vault_token_address: str, user_address: str) -> bool:
        """Disconnect a user's RoyaltyVault from optimization."""
        result = self.vault_manager.disconnect_vault(vault_token_address, user_address)
        return result["success"]

    def get_connected_vaults(self) -> List[Dict[str, Any]]:
        """Get all currently connected RoyaltyVaults."""
        return self.vault_manager.get_all_connected_vaults()

    def get_user_vaults(self, user_address: str) -> List[Dict[str, Any]]:
        """Get connected vaults for a specific user."""
        return self.vault_manager.get_user_vaults(user_address)

    def get_vault_balance(self) -> Dict[str, float]:
        """Get current balance in our ERC4626 vault."""
        try:
            # Get USDC balance in our vault (what we actually optimize)
            vault_balance = self.strategy_executor.get_vault_balance(self.our_vault_address)
            logger.info(f"Our vault balance: {vault_balance}")
            return vault_balance
        except Exception as e:
            logger.error(f"Error getting vault balance: {e}")
            return {}

    def analyze_lending_pool_performance(self) -> Dict[str, Any]:
        """
        Analyze performance of lending pools and yield opportunities.
        
        Returns:
            Market analysis with available yields
        """
        logger.info("Analyzing lending pool performance...")
        
        analysis = {
            "available_strategies": {},
            "best_apy": 0,
            "best_strategy": None,
            "risk_levels": {},
            "liquidity_depth": {}
        }
        
        try:
            # Fetch current yields from all providers
            aave_data = self.data_providers['aave'].fetch_data()
            compound_data = self.data_providers['compound'].fetch_data()
            defillama_data = self.data_providers['defillama'].fetch_data()
            
            logger.info(f"Aave data: {aave_data}")
            logger.info(f"Compound data: {compound_data}")
            logger.info(f"DeFiLlama data: {defillama_data}")
            
            # Extract APYs for USDC (primary optimization token)
            aave_apy = aave_data.get('aprs', {}).get('USDC', {}).get('supply_apr', 5.0) / 100
            compound_apy = compound_data.get('aprs', {}).get('USDC', {}).get('supply_apr', 4.8) / 100
            
            strategies = {
                'aave_usdc': {
                    'apy': aave_apy,
                    'risk': 'low',
                    'liquidity': aave_data.get('pool_data', {}).get('USDC', {}).get('total_liquidity', 0)
                },
                'compound_usdc': {
                    'apy': compound_apy, 
                    'risk': 'low',
                    'liquidity': compound_data.get('pool_data', {}).get('USDC', {}).get('total_liquidity', 0)
                }
            }
            
            analysis['available_strategies'] = strategies
            
            # Find best strategy
            best_strategy = max(strategies.items(), key=lambda x: x[1]['apy'])
            analysis['best_strategy'] = best_strategy[0]
            analysis['best_apy'] = best_strategy[1]['apy']
            
            logger.info(f"Best available strategy: {analysis['best_strategy']} with {analysis['best_apy']:.1%} APY")
            
        except Exception as e:
            logger.error(f"Error analyzing lending pools: {e}")
            # Fallback values
            analysis['best_apy'] = self.min_yield_threshold
            analysis['best_strategy'] = 'aave_usdc'
        
        return analysis

    def generate_optimization_strategy(self, vault_balance: Dict[str, float], market_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate yield optimization strategy for our ERC4626 vault.
        
        Args:
            vault_balance: Current vault balances
            market_data: Current market data
            
        Returns:
            Optimization strategy
        """
        # Prepare context for LLM
        vault_context = {
            "vault_info": {
                "address": self.our_vault_address,
                "balance": vault_balance,
                "type": "ERC4626_YIELD_VAULT"
            },
            "available_yields": market_data,
            "user_risk_profile": "conservative",  # IP creators prefer safety
            "optimization_goal": "maximize_safe_yield"
        }
        
        # Get historical context
        historical_context = self.knowledge_box.get_context()
        
        # Generate strategy using LLM
        try:
            strategy = self.llm_planner.generate_strategy(
                market_data=vault_context,
                historical_context=historical_context
            )
            
            # Use existing Composable strategy enhancement
            enhanced_strategy = self._enhance_strategy_for_vault(strategy, vault_balance, market_data)
            
            return enhanced_strategy
            
        except Exception as e:
            logger.error(f"Failed to generate strategy: {e}")
            return None

    def _enhance_strategy_for_vault(self, strategy: Dict[str, Any], vault_balance: Dict[str, float], market_data: Dict[str, Any]) -> Dict[str, Any]:
        """Enhance strategy with vault-specific actions using existing Composable framework."""
        if not strategy or not isinstance(strategy, dict):
            # Create basic strategy if LLM failed
            strategy = {
                "strategy_type": "yield_optimization",
                "target_protocol": market_data.get('best_strategy', 'aave'),
                "actions": [],
                "expected_outcome": {"apr": market_data.get('best_apy', 0.05), "risk_level": "low"}
            }
        
        enhanced_strategy = strategy.copy()
        
        # Add vault optimization actions using existing Composable patterns
        optimization_actions = []
        
        # Check if we have sufficient balance to optimize
        usdc_balance = vault_balance.get('balance_usdc', 0)
        logger.info(f"🔍 Debug: usdc_balance={usdc_balance}, min_threshold={self.min_balance_threshold}")
        logger.info(f"🔍 Debug: Available vault balance keys: {list(vault_balance.keys())}")
        if usdc_balance >= self.min_balance_threshold:
            
            # Deploy to best strategy - map strategy name to actual contract address
            best_strategy_name = market_data.get('best_strategy', 'aave_usdc')
            deployment_amount = int(usdc_balance * 0.8)  # Deploy 80%, keep 20% liquid
            
            # Map strategy names to actual deployed contract addresses
            strategy_addresses = {
                'aave_usdc': os.getenv('AAVE_STRATEGY_ADDRESS'),
                'compound_usdc': os.getenv('COMPOUND_STRATEGY_ADDRESS')
            }
            
            strategy_address = strategy_addresses.get(best_strategy_name)
            if not strategy_address:
                logger.error(f"No deployed contract found for strategy: {best_strategy_name}")
                return enhanced_strategy
            
            optimization_actions.append({
                "action_type": "deploy_to_strategy",
                "parameters": {
                    "vault_address": self.our_vault_address,
                    "token": "USDC",
                    "amount": deployment_amount,
                    "strategy": strategy_address,
                    "target_apy": market_data.get('best_apy', 0.05)
                }
            })
            
            logger.info(f"Planning to deploy {deployment_amount} USDC to {best_strategy_name} ({strategy_address})")
        
        # Monitoring handled by periodic runs of the main orchestrator
        # No need for explicit monitor_performance action
        
        enhanced_strategy['actions'] = optimization_actions
        enhanced_strategy['vault_address'] = self.our_vault_address
        enhanced_strategy['strategy_type'] = 'vault_yield_optimization'
        
        return enhanced_strategy

    def optimize_vault(self) -> bool:
        """
        Optimize our ERC4626 vault using existing Composable strategies.
        
        Returns:
            bool: Success status
        """
        try:
            logger.info(f"Optimizing our vault: {self.our_vault_address}")
            
            # 1. Get current vault balance
            vault_balance = self.strategy_executor.get_vault_balance()
            
            if not vault_balance or vault_balance.get('balance_usdc', 0) < self.min_balance_threshold:
                logger.info(f"Vault balance too low for optimization: {vault_balance}")
                return True
            
            # 2. Analyze lending pool performance  
            market_analysis = self.analyze_lending_pool_performance()
            
            # 3. Only proceed if yield opportunity exists
            if market_analysis['best_apy'] < self.min_yield_threshold:
                logger.info(f"No attractive yield opportunities")
                return True
            
            # 4. Generate optimization strategy
            strategy = self.generate_optimization_strategy(vault_balance, market_analysis)
            
            if not strategy:
                logger.error(f"Failed to generate strategy")
                return False
            
            # 5. Assess risk using existing Composable risk model
            risk_score = self.risk_model.score_strategy(strategy)
            is_safe = self.risk_model.is_strategy_safe(strategy)
            
            logger.info(f"Strategy risk score: {risk_score:.3f}, Safe: {is_safe}")
            
            # 6. Execute if acceptable risk using existing Composable executor
            if is_safe or risk_score < 0.6:
                success = self.strategy_executor.execute(strategy)
                
                if success:
                    # Record successful optimization
                    outcome = {
                        "success": True,
                        "executed_at": time.time(),
                        "risk_score": risk_score,
                        "expected_apr": strategy.get('expected_outcome', {}).get('apr', 0),
                        "deployed_amount": vault_balance.get('USDC', 0)
                    }
                    self.knowledge_box.add_strategy_outcome(strategy, outcome)
                    
                    logger.info(f"Successfully optimized vault")
                    return True
                else:
                    logger.error(f"Failed to execute strategy")
                    return False
            else:
                logger.warning(f"Strategy rejected - risk too high")
                return False
                
        except Exception as e:
            logger.error(f"Error optimizing vault: {e}")
            return False

    def run_optimization_cycle(self):
        """Run optimization cycle for connected user RoyaltyVaults."""
        try:
            logger.info("Starting optimization cycle...")
            
            # Get connected vaults that need optimization
            candidates = self.vault_manager.get_optimization_candidates()
            
            if not candidates:
                logger.info("No connected RoyaltyVaults ready for optimization")
                # Still optimize our main vault
                success = self.optimize_vault()
                return
            
            logger.info(f"Found {len(candidates)} connected RoyaltyVaults for optimization")
            
            # Process each connected vault
            results = []
            for vault_info in candidates:
                logger.info(f"Processing RoyaltyVault: {vault_info['vault_address']} for user: {vault_info['user_address']}")
                
                # This would trigger royalty extraction + bridging + optimization
                success = self.process_royalty_vault(vault_info)
                results.append({
                    "vault": vault_info['vault_address'],
                    "user": vault_info['user_address'],
                    "success": success
                })
                
                if success:
                    # Update last optimized timestamp
                    self.vault_manager.update_vault_status(
                        vault_info['vault_address'],
                        vault_info['user_address'],
                        {'last_optimized': time.time()}
                    )
            
            # Also optimize our main vault
            main_vault_success = self.optimize_vault()
            
            # Log results
            successful = sum(1 for r in results if r['success'])
            total = len(results)
            logger.info(f"RoyaltyVault optimization: {successful}/{total} successful")
            logger.info(f"Main vault optimization: {'✅' if main_vault_success else '❌'}")
            
        except Exception as e:
            logger.error(f"Error in optimization cycle: {e}")

    def process_royalty_vault(self, vault_info: Dict[str, Any]) -> bool:
        """
        Process a connected RoyaltyVault: extract royalties → bridge → optimize.
        
        This is where the full pipeline would execute:
        1. Extract royalties from Story Protocol RoyaltyVault
        2. Bridge via deBridge to USDC
        3. Deposit USDC into our ERC4626 vault
        4. Trigger optimization of our vault
        """
        try:
            logger.info(f"Processing RoyaltyVault {vault_info['vault_address']}")
            
            # TODO: Implement full pipeline
            # For now, just ensure our main vault gets optimized
            # The actual royalty extraction and bridging would happen here
            
            logger.info("✅ RoyaltyVault processing completed (placeholder)")
            return True
            
        except Exception as e:
            logger.error(f"Error processing RoyaltyVault {vault_info['vault_address']}: {e}")
            return False

    def run_continuous(self):
        """Run continuous optimization with periodic cycles."""
        logger.info("Starting continuous vault yield optimization...")
        logger.info(f"Target vault: {self.our_vault_address}")
        logger.info(f"Optimization interval: {self.optimization_interval} seconds")
        
        while True:
            try:
                self.run_optimization_cycle()
                
                logger.info(f"Sleeping for {self.optimization_interval} seconds...")
                time.sleep(self.optimization_interval)
                
            except KeyboardInterrupt:
                logger.info("Optimization stopped by user")
                break
            except Exception as e:
                logger.error(f"Unexpected error in continuous optimization: {e}")
                time.sleep(60)  # Wait 1 minute before retrying

    def run_once(self):
        """Run optimization once and exit."""
        logger.info("Running single optimization cycle...")
        logger.info(f"Target vault: {self.our_vault_address}")
        
        # FOR TESTING: Connect a test RoyaltyVault
        test_royalty_vault = self.config['story_protocol'].get('example_royalty_vault', '0x32dC6995a55DBb0D35931693e3Ee14415A611a72')
        test_user = "0xd7220db831Ce0c7D33a4fD234208d245225D26d1"
        
        logger.info(f"Testing connection of RoyaltyVault: {test_royalty_vault}")
        connection_success = self.connect_user_vault(test_royalty_vault, test_user)
        
        if connection_success:
            logger.info("✅ Test RoyaltyVault connected successfully")
        else:
            logger.warning("⚠️ Test RoyaltyVault connection failed, but continuing...")
        
        # Run optimization cycle
        self.run_optimization_cycle()

def main():
    """Entry point for the Composable Yield Optimizer."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Composable Vault Yield Optimizer')
    parser.add_argument('--mode', choices=['once', 'continuous'], default='once',
                        help='Run once or continuously')
    parser.add_argument('--config', default='configs/config.yaml',
                        help='Configuration file path')
    
    args = parser.parse_args()
    
    # Initialize optimizer
    optimizer = ComposableYieldOptimizer(args.config)
    
    # Run based on mode
    if args.mode == 'continuous':
        optimizer.run_continuous()
    else:
        optimizer.run_once()

if __name__ == "__main__":
    main()
