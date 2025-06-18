"""
Knowledge management module for storing and retrieving historical DeFi patterns.
"""

import json
from pathlib import Path
from typing import Dict, Any, List
import pandas as pd

class KnowledgeBox:
    def __init__(self, data_dir: str = "data/knowledge"):
        """Initialize the knowledge box with data directory."""
        self.data_dir = Path(data_dir)
        self.patterns_file = self.data_dir / "market_patterns.json"
        self.outcomes_file = self.data_dir / "strategy_outcomes.json"
        self.risk_events_file = self.data_dir / "risk_events.json"
        
        # Ensure data directory exists
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize data structures
        self.market_patterns = self._load_json(self.patterns_file, {})
        self.strategy_outcomes = self._load_json(self.outcomes_file, {})
        self.risk_events = self._load_json(self.risk_events_file, {})

    def _load_json(self, file_path: Path, default: Dict) -> Dict:
        """Load JSON data from file or return default if file doesn't exist."""
        try:
            if file_path.exists():
                with open(file_path, 'r') as f:
                    return json.load(f)
            return default
        except Exception as e:
            print(f"Error loading {file_path}: {e}")
            return default

    def _save_json(self, file_path: Path, data: Dict):
        """Save data to JSON file."""
        try:
            with open(file_path, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"Error saving to {file_path}: {e}")

    def get_context(self) -> Dict[str, Any]:
        """
        Get relevant historical context for strategy generation.
        
        Returns:
            Dict containing historical patterns, outcomes, and risk events
        """
        return {
            "market_patterns": self.market_patterns,
            "strategy_outcomes": self.strategy_outcomes,
            "risk_events": self.risk_events
        }

    def add_market_pattern(self, pattern: Dict[str, Any]):
        """Add a new market pattern to the knowledge base."""
        import time
        
        # Add timestamp and unique ID
        pattern_id = f"pattern_{int(time.time())}"
        pattern['timestamp'] = time.time()
        pattern['id'] = pattern_id
        
        # Store in market_patterns dict
        self.market_patterns[pattern_id] = pattern
        
        # Save to file
        self._save_json(self.patterns_file, self.market_patterns)

    def add_strategy_outcome(self, strategy: Dict[str, Any], outcome: Dict[str, Any]):
        """Add a strategy outcome to the knowledge base."""
        import time
        
        # Create outcome record
        outcome_id = f"outcome_{int(time.time())}"
        outcome_record = {
            'id': outcome_id,
            'timestamp': time.time(),
            'strategy': strategy,
            'outcome': outcome
        }
        
        # Store in strategy_outcomes dict
        self.strategy_outcomes[outcome_id] = outcome_record
        
        # Save to file
        self._save_json(self.outcomes_file, self.strategy_outcomes)

    def add_risk_event(self, event: Dict[str, Any]):
        """Add a risk event to the knowledge base."""
        import time
        
        # Add timestamp and unique ID
        event_id = f"risk_{int(time.time())}"
        event['timestamp'] = time.time()
        event['id'] = event_id
        
        # Store in risk_events dict
        self.risk_events[event_id] = event
        
        # Save to file
        self._save_json(self.risk_events_file, self.risk_events)

    def get_similar_patterns(self, current_market: Dict[str, Any], n: int = 5) -> List[Dict[str, Any]]:
        """
        Find similar historical market patterns.
        
        Args:
            current_market: Current market state
            n: Number of similar patterns to return
            
        Returns:
            List of similar historical patterns
        """
        if not self.market_patterns:
            return []
        
        # Simple similarity based on common keys
        similarities = []
        
        for pattern_id, pattern in self.market_patterns.items():
            similarity_score = self._calculate_similarity(current_market, pattern)
            similarities.append((similarity_score, pattern))
        
        # Sort by similarity and return top n
        similarities.sort(key=lambda x: x[0], reverse=True)
        return [pattern for _, pattern in similarities[:n]]

    def get_protocol_risk_history(self, protocol: str) -> Dict[str, Any]:
        """
        Get historical risk data for a specific protocol.
        
        Args:
            protocol: Protocol name
            
        Returns:
            Dict containing protocol risk history
        """
        # Search through stored risk events for this protocol
        protocol_events = []
        for event_id, event in self.risk_events.items():
            # Ensure event is a dict, not a list
            if isinstance(event, dict) and event.get('protocol', '').lower() == protocol.lower():
                protocol_events.append(event)
        
        # Search through strategy outcomes for this protocol
        protocol_outcomes = []
        for outcome_id, record in self.strategy_outcomes.items():
            # Ensure record is a dict
            if isinstance(record, dict):
                strategy = record.get('strategy', {})
                if isinstance(strategy, dict) and strategy.get('target_protocol', '').lower() == protocol.lower():
                    protocol_outcomes.append(record)
        
        # Calculate basic statistics
        if protocol_outcomes:
            outcomes = [record.get('outcome', {}) for record in protocol_outcomes if isinstance(record, dict)]
            outcomes = [o for o in outcomes if isinstance(o, dict)]  # Filter out non-dict outcomes
            
            if outcomes:
                avg_return = sum(o.get('actual_apr', 0) for o in outcomes) / len(outcomes)
                success_rate = sum(1 for o in outcomes if o.get('success', False)) / len(outcomes)
            else:
                avg_return = 0
                success_rate = 0
        else:
            avg_return = 0
            success_rate = 0
        
        return {
            "protocol": protocol,
            "risk_events": protocol_events,
            "strategy_outcomes": protocol_outcomes,
            "avg_return": avg_return,
            "success_rate": success_rate,
            "total_strategies": len(protocol_outcomes),
            "total_incidents": len(protocol_events)
        }
    def _calculate_similarity(self, market1: Dict[str, Any], market2: Dict[str, Any]) -> float:
        """
        Calculate similarity score between two market states.
        
        Args:
            market1: First market state
            market2: Second market state
            
        Returns:
            float: Similarity score between 0 and 1
        """
        # Get common keys
        common_keys = set(market1.keys()) & set(market2.keys())
        
        if not common_keys:
            return 0.0
        
        # Calculate similarity for numeric values
        similarities = []
        for key in common_keys:
            val1 = market1[key]
            val2 = market2[key]
            
            # Handle numeric values
            if isinstance(val1, (int, float)) and isinstance(val2, (int, float)):
                if val1 == 0 and val2 == 0:
                    sim = 1.0
                else:
                    # Normalize by larger value to get percentage similarity
                    max_val = max(abs(val1), abs(val2))
                    diff = abs(val1 - val2)
                    sim = 1 - (diff / max_val) if max_val > 0 else 1.0
                similarities.append(sim)
            
            # Handle string values
            elif isinstance(val1, str) and isinstance(val2, str):
                sim = 1.0 if val1.lower() == val2.lower() else 0.0
                similarities.append(sim)
        
        # Return average similarity
        return sum(similarities) / len(similarities) if similarities else 0.0