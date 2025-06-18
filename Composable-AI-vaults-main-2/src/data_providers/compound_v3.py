"""
Compound V3 protocol data provider.
Fetches lending and protocol data from Compound V3 on Ethereum mainnet.
"""

from typing import Dict, Any
import requests
from web3 import Web3
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class CompoundV3Provider:
    def __init__(self, config: Dict[str, Any]):
        """Initialize the Compound V3 data provider with configuration."""
        self.comet_address = config.get('comet_address', '0xc3d688B66703497DAA19211EEdff47f25384cdc3')  # Default USDC Comet
        self.rpc_url = config.get('rpc_url', 'https://eth-mainnet.g.alchemy.com/v2/exAp0m_LKHnmcM2Uni2BbYH5cLgBYaV2')
        
        # Initialize Web3 connection
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        if not self.w3.is_connected():
            raise Exception("Failed to connect to Ethereum RPC")

    def fetch_data(self) -> Dict[str, Any]:
        """
        Fetch current data from Compound V3 protocol.
        
        Returns:
            Dict containing pool data, APRs, and other relevant information
        """
        try:
            # Fetch pool data for supported assets
            pool_data = self._fetch_pool_data()
            
            # Calculate APRs
            aprs = self._calculate_aprs(pool_data)
            
            return {
                "pool_data": pool_data,
                "aprs": aprs,
                "timestamp": self._get_current_timestamp()
            }
            
        except Exception as e:
            logger.error(f"Error fetching Compound V3 data: {e}")
            raise

    def _fetch_pool_data(self) -> Dict[str, Any]:
        """Fetch pool data from Compound V3 for major assets."""
        try:
            # Asset configuration for USDC Comet
            assets = {
                "USDC": {
                    "address": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
                    "decimals": 6,
                    "is_base": True  # USDC is the base asset in this comet
                }
            }
            
            # Get Comet contract
            comet_contract = self.w3.eth.contract(
                address=self.w3.to_checksum_address(self.comet_address),
                abi=self._get_comet_abi()
            )
            
            results = {}
            
            for symbol, config in assets.items():
                try:
                    asset_address = self.w3.to_checksum_address(config["address"])
                    decimals = config["decimals"]
                    
                    # For USDC base asset, get supply/borrow data
                    total_supply_raw = comet_contract.functions.totalSupply().call()
                    total_borrow_raw = comet_contract.functions.totalBorrow().call()
                    
                    # Convert from raw units
                    total_supply = total_supply_raw / (10 ** decimals)
                    total_borrow = total_borrow_raw / (10 ** decimals)
                    
                    # Calculate utilization rate first
                    utilization_rate = total_borrow_raw / total_supply_raw if total_supply_raw > 0 else 0
                    
                    # Get current utilization for rate calculation
                    current_utilization = int(utilization_rate * 1e18)  # Convert to wei-like format
                    supply_rate = comet_contract.functions.getSupplyRate(current_utilization).call()
                    borrow_rate = comet_contract.functions.getBorrowRate(current_utilization).call()
                    
                    results[symbol] = {
                        "total_liquidity": total_supply,
                        "total_borrows": total_borrow,
                        "utilization_rate": utilization_rate,
                        "supply_rate": supply_rate,
                        "borrow_rate": borrow_rate,
                        "asset": symbol,
                        "asset_address": asset_address,
                        "is_base_asset": True
                    }
                        
                except Exception as e:
                    logger.error(f"Error fetching {symbol} data: {e}")
                    continue
            
            results["last_update_timestamp"] = self._get_current_timestamp()
            return results
            
        except Exception as e:
            logger.error(f"Error fetching Compound pool data: {e}")
            return {}

    def _calculate_aprs(self, pool_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate APRs based on Compound pool data."""
        try:
            # Compound V3 uses per-second rates (scaled by 1e18)
            SECONDS_PER_YEAR = 365 * 24 * 60 * 60
            RATE_SCALE = 1e18
            
            aprs = {}
            
            for asset_symbol, data in pool_data.items():
                if asset_symbol == "last_update_timestamp":
                    continue
                    
                # Convert rates from per-second to APR
                supply_rate = data.get('supply_rate', 0)
                borrow_rate = data.get('borrow_rate', 0)
                utilization_rate = data.get('utilization_rate', 0)
                
                # Convert to annual percentage rates
                # Compound V3 rates are already scaled, so divide by scale factor
                supply_apr = (supply_rate / RATE_SCALE) * SECONDS_PER_YEAR * 100
                borrow_apr = (borrow_rate / RATE_SCALE) * SECONDS_PER_YEAR * 100
                
                aprs[asset_symbol] = {
                    "supply_apr": supply_apr,
                    "borrow_apr": borrow_apr,
                    "utilization_rate": utilization_rate * 100,
                    "asset": asset_symbol
                }
            
            return aprs
            
        except Exception as e:
            logger.error(f"Error calculating Compound APRs: {e}")
            return {}

    def _get_current_timestamp(self) -> int:
        """Get current block timestamp."""
        try:
            return self.w3.eth.get_block('latest')['timestamp']
        except Exception as e:
            logger.error(f"Error getting timestamp: {e}")
            return int(datetime.now().timestamp())

    def _get_comet_abi(self) -> list:
        """Get the ABI for the Compound V3 Comet contract."""
        return [
            {
                "inputs": [],
                "name": "totalSupply",
                "outputs": [{"type": "uint104"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "totalBorrow",
                "outputs": [{"type": "uint104"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [{"name": "utilization", "type": "uint256"}],
                "name": "getSupplyRate",
                "outputs": [{"type": "uint256"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [{"name": "utilization", "type": "uint256"}],
                "name": "getBorrowRate",
                "outputs": [{"type": "uint256"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [{"name": "asset", "type": "address"}],
                "name": "getAssetInfo",
                "outputs": [
                    {
                        "components": [
                            {"name": "offset", "type": "uint8"},
                            {"name": "asset", "type": "address"},
                            {"name": "priceFeed", "type": "address"},
                            {"name": "scale", "type": "uint64"},
                            {"name": "borrowCollateralFactor", "type": "uint64"},
                            {"name": "liquidateCollateralFactor", "type": "uint64"},
                            {"name": "liquidationFactor", "type": "uint64"},
                            {"name": "supplyCap", "type": "uint128"}
                        ],
                        "type": "tuple"
                    }
                ],
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
        # TODO: Implement historical APR fetching
        return {
            "dates": [],
            "supply_aprs": [],
            "borrow_aprs": [],
            "asset": asset
        }
