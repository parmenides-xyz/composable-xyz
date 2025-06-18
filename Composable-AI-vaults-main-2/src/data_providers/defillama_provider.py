"""
DeFiLlama data provider.
Fetches protocol TVL and metadata from DeFiLlama API.
"""

import requests
import logging
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class DeFiLlamaProvider:
    def __init__(self, config: Dict[str, Any]):
        """Initialize the DeFiLlama data provider with configuration."""
        self.api_url = "https://api.llama.fi"
        self.protocol_slug = config.get('protocol_slug')
        if not self.protocol_slug:
            raise ValueError("protocol_slug must be provided in config")

    def fetch_data(self) -> Dict[str, Any]:
        """
        Fetch current protocol data from DeFiLlama.
        
        Returns:
            Dict containing formatted protocol data
        """
        try:
            raw_data = self.fetch_protocol_data()
            return self.format_for_knowledge_box(raw_data)
        except Exception as e:
            logger.error(f"Error in fetch_data: {e}")
            return {}

    def fetch_protocol_data(self) -> Dict[str, Any]:
        """
        Fetch protocol data from DeFiLlama.
        
        Returns:
            Dict containing protocol TVL, metadata, and chain information
        """
        try:
            # Fetch protocol data
            endpoint = f"{self.api_url}/protocol/{self.protocol_slug}"
            response = requests.get(endpoint)
            response.raise_for_status()
            data = response.json()

            # Extract relevant data
            protocol_data = {
                "tvl": data.get("tvl", {}),
                "chain": data.get("chain", "unknown"),
                "name": data.get("name", self.protocol_slug),
                "symbol": data.get("symbol", ""),
                "url": data.get("url", ""),
                "description": data.get("description", ""),
                "audit_links": data.get("audit_links", []),
                "twitter": data.get("twitter", ""),
                "tvl_history": data.get("tvl", []),
                "currentChainTvls": data.get("currentChainTvls", {}),
                "last_updated": datetime.now().isoformat()
            }

            return protocol_data

        except Exception as e:
            logger.error(f"Error fetching DeFiLlama data: {e}")
            return {}

    def get_tvl_history(self, days: int = 7) -> Dict[str, float]:
        """
        Get TVL history for the specified number of days.
        
        Args:
            days: Number of days of history to fetch
            
        Returns:
            Dict mapping dates to TVL values
        """
        try:
            data = self.fetch_protocol_data()
            tvl_history = data.get("tvl_history", [])
            
            # Convert to daily TVL values
            daily_tvl = {}
            for entry in tvl_history:
                date = datetime.fromtimestamp(entry["date"]).strftime("%Y-%m-%d")
                daily_tvl[date] = entry["totalLiquidityUSD"]
            
            return daily_tvl

        except Exception as e:
            logger.error(f"Error fetching TVL history: {e}")
            return {}

    def get_chain_tvl(self) -> Dict[str, float]:
        """
        Get current TVL breakdown by chain.
        
        Returns:
            Dict mapping chain names to TVL values
        """
        try:
            data = self.fetch_protocol_data()
            return data.get("currentChainTvls", {})
        except Exception as e:
            logger.error(f"Error fetching chain TVL: {e}")
            return {}

    def format_for_knowledge_box(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Format raw DeFiLlama data for the knowledge box.
        
        Args:
            raw_data: Raw data from DeFiLlama
            
        Returns:
            Formatted data for knowledge box
        """
        tvl_data = raw_data.get("tvl", [])
        
        # Handle TVL as list (historical data) or dict (current data)
        if isinstance(tvl_data, list) and tvl_data:
            # Get latest TVL from historical data
            latest_tvl = tvl_data[-1].get("totalLiquidityUSD", 0) if tvl_data else 0
            tvl_7d_ago = tvl_data[-7].get("totalLiquidityUSD", 0) if len(tvl_data) >= 7 else latest_tvl
        elif isinstance(tvl_data, dict):
            # Handle as dict structure
            latest_tvl = tvl_data.get("current", 0)
            tvl_7d_ago = tvl_data.get("7d", 0)
        else:
            latest_tvl = 0
            tvl_7d_ago = 0
        
        return {
            "protocol_id": self.protocol_slug,
            "tvl_7d": tvl_7d_ago,
            "tvl_current": latest_tvl,
            "chain": raw_data.get("chain", "unknown"),
            "name": raw_data.get("name", self.protocol_slug),
            "last_updated": raw_data.get("last_updated"),
            "chain_tvl": raw_data.get("currentChainTvls", {}),
            "audit_links": raw_data.get("audit_links", []),
            "twitter": raw_data.get("twitter", ""),
            "url": raw_data.get("url", "")
        }
