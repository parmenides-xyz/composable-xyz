"""
Risk assessment module for evaluating strategy safety.
Uses trained anomaly detection model to score DeFi protocols.
"""

import json
import numpy as np
from typing import Dict, Any
from pathlib import Path
import sys
import os

# Add the ml-risk directory to the path
parent_dir = os.path.dirname(os.path.dirname(__file__))
ml_risk_path = os.path.join(parent_dir, 'ml-risk')
sys.path.append(ml_risk_path)

try:
    from risk_api import RiskAssessmentAPI
except ImportError:
    print("Warning: Could not import risk_api. Make sure ml-risk model is trained.")
    RiskAssessmentAPI = None

class RiskModel:
    def __init__(self, model_path: str = None):
        """Initialize the risk assessment model."""
        if model_path is None:
            # Get absolute path to the model
            current_dir = os.path.dirname(os.path.abspath(__file__))
            project_root = os.path.dirname(current_dir)  # Go up from agent/ to src/
            model_path = os.path.join(project_root, 'ml-risk', 'models', 'anomaly_risk_model.joblib')
        
        self.model_path = Path(model_path)
        
        # Initialize the trained anomaly detection model
        if RiskAssessmentAPI:
            try:
                self.risk_api = RiskAssessmentAPI(str(self.model_path))
                print("✅ Risk model loaded successfully")
            except Exception as e:
                print(f"❌ Risk model not found. Run anomaly_risk_model.py first.")
                self.risk_api = None
        else:
            print("❌ RiskAssessmentAPI not available")
            self.risk_api = None

    def _load_model(self):
        """Load the trained risk assessment model."""
        # Model loading is handled in __init__ via RiskAssessmentAPI
        pass

    def _extract_protocol_address(self, strategy: Dict[str, Any]) -> str:
        """
        Extract protocol contract address from strategy.
        
        Args:
            strategy: The strategy containing protocol info
            
        Returns:
            str: Protocol contract address or empty string
        """
        # Try different ways to extract protocol address
        if 'target_protocol' in strategy:
            protocol = strategy['target_protocol']
            
            # If it's already an address
            if isinstance(protocol, str) and protocol.startswith('0x'):
                return protocol
            
            # If it's a protocol name, map to known addresses
            protocol_addresses = {
                'aave': '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
                'aave v3': '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',  # Add AAVE V3
                'compound': '0xc00e94cb662c3520282e6f5717214004a7f26888',
                'compound v3': '0xc00e94cb662c3520282e6f5717214004a7f26888',  # Add Compound V3
                'uniswap': '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
                'curve': '0xd533a949740bb3306d119cc777fa900ba034cd52',
                'usdc': '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                'usdt': '0xdac17f958d2ee523a2206206994597c13d831ec7',
                'weth': '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
            }
            
            protocol_lower = protocol.lower()
            if protocol_lower in protocol_addresses:
                return protocol_addresses[protocol_lower]
        
        # Check actions for contract addresses
        if 'actions' in strategy:
            for action in strategy['actions']:
                if 'parameters' in action:
                    params = action['parameters']
                    if 'contract' in params:
                        return params['contract']
                    if 'protocol' in params:
                        return params['protocol']
        
        return ""

    def score_strategy(self, strategy: Dict[str, Any]) -> float:
        """
        Score a strategy's risk level using trained anomaly detection.
        
        Args:
            strategy: The strategy to score
            
        Returns:
            float: Risk score between 0 and 1, where 0 is safest, 1 is riskiest
        """
        try:
            # Validate strategy format
            if not self._validate_strategy_format(strategy):
                raise ValueError("Invalid strategy format")
            
            # Extract protocol address from strategy
            protocol_address = self._extract_protocol_address(strategy)
            
            if not protocol_address:
                # If no protocol address, return moderate risk
                return 0.5
            
            # Use trained model to assess protocol risk
            if self.risk_api:
                risk_score = self.risk_api.assess_strategy_risk(protocol_address)
                return risk_score
            else:
                # Fallback: return moderate risk if model unavailable
                print("⚠️ Risk model unavailable, using fallback scoring")
                return 0.5
                
        except Exception as e:
            print(f"Error scoring strategy: {e}")
            return 0.5  # Default to moderate risk on error

    def _validate_strategy_format(self, strategy: Dict[str, Any]) -> bool:
        """Validate that the strategy has the required format for risk assessment."""
        required_fields = ["strategy_type", "target_protocol", "actions", "expected_outcome"]
        return all(field in strategy for field in required_fields)

    def is_strategy_safe(self, strategy: Dict[str, Any], risk_threshold: float = 0.5) -> bool:
        """
        Determine if a strategy is safe based on risk threshold.
        
        Args:
            strategy: Strategy to evaluate
            risk_threshold: Maximum acceptable risk score
            
        Returns:
            bool: True if strategy is safe, False otherwise
        """
        risk_score = self.score_strategy(strategy)
        return bool(risk_score < risk_threshold)

    def get_risk_factors(self, strategy: Dict[str, Any]) -> Dict[str, float]:
        """
        Get detailed risk factors for a strategy.
        
        Args:
            strategy: The strategy to analyze
            
        Returns:
            Dict mapping risk factors to their scores
        """
        try:
            protocol_address = self._extract_protocol_address(strategy)
            
            if protocol_address and self.risk_api:
                # Get detailed assessment from trained model
                detailed = self.risk_api.get_detailed_assessment(protocol_address)
                
                if 'features' in detailed:
                    features = detailed['features']
                    return {
                        "protocol_risk": 1 - detailed.get('risk_score', 0.5),
                        "activity_level": min(1.0, features.get('total_txns', 0) / 1000),
                        "user_diversity": min(1.0, features.get('unique_users', 0) / 500),
                        "value_stability": 1 - min(1.0, features.get('value_std', 0)),
                        "method_diversity": min(1.0, features.get('method_diversity', 0) / 10)
                    }
            
            # Fallback risk factors
            return {
                "protocol_risk": 0.5,
                "activity_level": 0.5,
                "user_diversity": 0.5,
                "value_stability": 0.5,
                "method_diversity": 0.5
            }
            
        except Exception as e:
            print(f"Error getting risk factors: {e}")
            return {
                "protocol_risk": 0.5,
                "activity_level": 0.5,
                "user_diversity": 0.5,
                "value_stability": 0.5,
                "method_diversity": 0.5
            }
