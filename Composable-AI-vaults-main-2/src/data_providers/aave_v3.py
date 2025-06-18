"""
AAVE V3 protocol data provider.
Fetches lending and protocol data from AAVE V3 on Ethereum mainnet.
"""

from typing import Dict, Any
import requests
from web3 import Web3
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class AaveV3Provider:
    def __init__(self, config: Dict[str, Any]):
        """Initialize the AAVE V3 data provider with configuration."""
        self.pool_address = config['pool_address']
        self.rpc_url = config.get('rpc_url', 'https://eth-mainnet.g.alchemy.com/v2/exAp0m_LKHnmcM2Uni2BbYH5cLgBYaV2')
        
        # Initialize Web3 connection
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        if not self.w3.is_connected():
            raise Exception("Failed to connect to Ethereum RPC")

    def fetch_data(self) -> Dict[str, Any]:
        """
        Fetch current data from AAVE V3 protocol.
        
        Returns:
            Dict containing pool data, APRs, and other relevant information
        """
        try:
            # Fetch pool data for major assets
            pool_data = self._fetch_pool_data()
            
            # Calculate APRs
            aprs = self._calculate_aprs(pool_data)
            
            return {
                "pool_data": pool_data,
                "aprs": aprs,
                "timestamp": self._get_current_timestamp()
            }
            
        except Exception as e:
            logger.error(f"Error fetching AAVE V3 data: {e}")
            raise

    def _fetch_pool_data(self) -> Dict[str, Any]:
        """Fetch pool data from AAVE V3 for major assets."""
        try:
            # Asset configurations: address, symbol, decimals
            assets = {
                "USDC": {
                    "address": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
                    "decimals": 6
                },
                "USDT": {
                    "address": "0xdac17f958d2ee523a2206206994597c13d831ec7", 
                    "decimals": 6
                },
                "WETH": {
                    "address": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
                    "decimals": 18
                }
            }
            
            # Get pool contract
            pool_contract = self.w3.eth.contract(
                address=self.w3.to_checksum_address(self.pool_address),
                abi=self._get_pool_abi()
            )
            
            results = {}
            
            for symbol, config in assets.items():
                try:
                    asset_address = self.w3.to_checksum_address(config["address"])
                    decimals = config["decimals"]
                    
                    # Fetch reserve data
                    reserve_data = pool_contract.functions.getReserveData(asset_address).call()
                    
                    # Extract rates
                    liquidity_rate = reserve_data[2]
                    variable_borrow_rate = reserve_data[4] 
                    stable_borrow_rate = reserve_data[5]
                    
                    # Get aToken contract for total liquidity
                    atoken_address = reserve_data[8]
                    atoken_contract = self.w3.eth.contract(
                        address=atoken_address,
                        abi=self._get_atoken_abi()
                    )
                    
                    total_supply_raw = atoken_contract.functions.totalSupply().call()
                    
                    # Get debt token contract for total borrows
                    debt_token_address = reserve_data[10]
                    debt_contract = self.w3.eth.contract(
                        address=debt_token_address,
                        abi=self._get_debt_token_abi()
                    )
                    
                    total_borrows_raw = debt_contract.functions.totalSupply().call()
                    
                    # Convert from raw units to actual token amounts
                    total_supply = total_supply_raw / (10 ** decimals)
                    total_borrows = total_borrows_raw / (10 ** decimals)
                    
                    # Calculate utilization rate
                    utilization_rate = total_borrows_raw / total_supply_raw if total_supply_raw > 0 else 0
                    
                    results[symbol] = {
                        "total_liquidity": total_supply,
                        "total_borrows": total_borrows,
                        "utilization_rate": utilization_rate,
                        "liquidity_rate": liquidity_rate,
                        "variable_borrow_rate": variable_borrow_rate,
                        "stable_borrow_rate": stable_borrow_rate,
                        "asset": symbol,
                        "asset_address": asset_address,
                        "atoken_address": atoken_address,
                        "debt_token_address": debt_token_address
                    }
                    
                except Exception as e:
                    logger.error(f"Error fetching {symbol} data: {e}")
                    continue
            
            results["last_update_timestamp"] = self._get_current_timestamp()
            return results
            
        except Exception as e:
            logger.error(f"Error fetching AAVE pool data: {e}")
            return {}

    def _calculate_aprs(self, pool_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate APRs based on AAVE pool data."""
        try:
            # AAVE uses ray units (1e27) for rates
            RAY = 1e27
            
            aprs = {}
            
            for asset_symbol, data in pool_data.items():
                if asset_symbol == "last_update_timestamp":
                    continue
                    
                # Convert rates from ray units to APR
                liquidity_rate = data.get('liquidity_rate', 0)
                variable_borrow_rate = data.get('variable_borrow_rate', 0)
                utilization_rate = data.get('utilization_rate', 0)
                
                # Convert to annual percentage rates
                supply_apr = (liquidity_rate / RAY) * 100
                borrow_apr = (variable_borrow_rate / RAY) * 100
                
                aprs[asset_symbol] = {
                    "supply_apr": supply_apr,
                    "borrow_apr": borrow_apr,
                    "utilization_rate": utilization_rate * 100,  # Convert to percentage
                    "asset": asset_symbol
                }
            
            return aprs
            
        except Exception as e:
            logger.error(f"Error calculating AAVE APRs: {e}")
            return {}

    def _get_current_timestamp(self) -> int:
        """Get current block timestamp."""
        try:
            return self.w3.eth.get_block('latest')['timestamp']
        except Exception as e:
            logger.error(f"Error getting timestamp: {e}")
            return int(datetime.now().timestamp())

    def get_asset_data(self, asset_address: str) -> Dict[str, Any]:
        """
        Get data for a specific asset in AAVE V3.
        
        Args:
            asset_address: Address of the asset
            
        Returns:
            Dict containing asset-specific data
        """
        try:
            pool_contract = self.w3.eth.contract(
                address=self.w3.to_checksum_address(self.pool_address),
                abi=self._get_pool_abi()
            )
            
            reserve_data = pool_contract.functions.getReserveData(asset_address).call()
            
            return {
                "asset_address": asset_address,
                "liquidity_rate": reserve_data[2],
                "variable_borrow_rate": reserve_data[4],
                "stable_borrow_rate": reserve_data[5],
                "atoken_address": reserve_data[8],
                "debt_token_address": reserve_data[10],
                "last_update_timestamp": self._get_current_timestamp()
            }
        except Exception as e:
            logger.error(f"Error getting AAVE asset data: {e}")
            return {}

    def _get_pool_abi(self) -> list:
        """Get the ABI for the AAVE V3 Pool contract."""
        return [
            {
                "inputs": [{"internalType": "address", "name": "asset", "type": "address"}],
                "name": "getReserveData",
                "outputs": [
                    {
                        "components": [
                            {"internalType": "uint256", "name": "configuration", "type": "uint256"},
                            {"internalType": "uint128", "name": "liquidityIndex", "type": "uint128"},
                            {"internalType": "uint128", "name": "currentLiquidityRate", "type": "uint128"},
                            {"internalType": "uint128", "name": "variableBorrowIndex", "type": "uint128"},
                            {"internalType": "uint128", "name": "currentVariableBorrowRate", "type": "uint128"},
                            {"internalType": "uint128", "name": "currentStableBorrowRate", "type": "uint128"},
                            {"internalType": "uint40", "name": "lastUpdateTimestamp", "type": "uint40"},
                            {"internalType": "uint16", "name": "id", "type": "uint16"},
                            {"internalType": "address", "name": "aTokenAddress", "type": "address"},
                            {"internalType": "address", "name": "stableDebtTokenAddress", "type": "address"},
                            {"internalType": "address", "name": "variableDebtTokenAddress", "type": "address"},
                            {"internalType": "address", "name": "interestRateStrategyAddress", "type": "address"},
                            {"internalType": "uint128", "name": "accruedToTreasury", "type": "uint128"},
                            {"internalType": "uint128", "name": "unbacked", "type": "uint128"},
                            {"internalType": "uint128", "name": "isolationModeTotalDebt", "type": "uint128"}
                        ],
                        "internalType": "struct DataTypes.ReserveData",
                        "name": "",
                        "type": "tuple"
                    }
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "getReservesList",
                "outputs": [{"internalType": "address[]", "name": "", "type": "address[]"}],
                "stateMutability": "view",
                "type": "function"
            }
        ]

    def _get_atoken_abi(self) -> list:
        """Get the ABI for AAVE aToken contract."""
        return [
            {
                "inputs": [],
                "name": "totalSupply",
                "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                "stateMutability": "view",
                "type": "function"
            }
        ]

    def _get_debt_token_abi(self) -> list:
        """Get the ABI for AAVE debt token contract."""
        return [
            {
                "inputs": [],
                "name": "totalSupply",
                "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                "stateMutability": "view",
                "type": "function"
            }
        ]

    def get_historical_aprs(self, asset: str, days: int = 30) -> Dict[str, Any]:
        """
        Get historical APR data for an asset.
        
        Args:
            asset: Asset symbol
            days: Number of days of history
            
        Returns:
            Dict containing historical APR data
        """
        # TODO: Implement historical APR fetching from AAVE subgraph or events
        return {
            "dates": [],
            "supply_aprs": [],
            "borrow_aprs": [],
            "asset": asset
        }
