# Live Story Protocol AI Agent Configuration

## 🔧 Production Configuration

### Contract Addresses (Story Protocol Mainnet)
```python
STORY_PROTOCOL_CONFIG = {
    'chain_id': 1514,
    'rpc_url': 'https://mainnet.storyrpc.io',
    'explorer': 'https://www.storyscan.io',
    
    'contracts': {
        'wrapper': '0x670d84987005083dE65C07672241f46dA678D24A',
        'vault': '0x0b5d50e41aAE56a7F1CA3E626BC17DB4fB8bdc5a',
        'factory': '0x9ac45538c6d27178650b3a50e39Afe9f0Db26Ca8'
    },
    
    'tokens': {
        'usdc': '0x72FEAa0F940303c9cC0Bb6081c7c595ff6370F35',
        'wbtc': '0x3747B3DE73dd4578454a104E1499254f35F3A55F',
        'weth': '0x3FC3382cD9B7AAdC4023271134b2e2710623c63E'
    }
}
```

### Environment Variables
```bash
# Add to your .env file:

# Story Protocol Network
STORY_RPC_URL="https://mainnet.storyrpc.io"
STORY_CHAIN_ID=1514

# Live Contract Addresses
ROYALTY_WRAPPER_ADDRESS="0x670d84987005083dE65C07672241f46dA678D24A"
BASE_VAULT_ADDRESS="0x0b5d50e41aAE56a7F1CA3E626BC17DB4fB8bdc5a"
VAULT_FACTORY_ADDRESS="0x9ac45538c6d27178650b3a50e39Afe9f0Db26Ca8"

# AI Agent Wallet (KEEP SECURE!)
AI_AGENT_PRIVATE_KEY="0x..."  # Your agent's private key
AI_AGENT_ADDRESS="0x..."      # Your agent's address

# Strategy Configuration
MIN_ROYALTY_AMOUNT=100000000  # 100 USDC (6 decimals)
REBALANCE_THRESHOLD=0.02      # 2% yield difference to trigger rebalance
GAS_PRICE_LIMIT=20000000000   # 20 gwei max
```

### Integration with SPQR-AI-vaults-praha-main-2

Copy this to your AI agent config:

```yaml
# config/story_protocol.yaml
story_protocol:
  enabled: true
  chain_id: 1514
  rpc_url: "https://mainnet.storyrpc.io"
  
  contracts:
    wrapper: "0x670d84987005083dE65C07672241f46dA678D24A"
    vault: "0x0b5d50e41aAE56a7F1CA3E626BC17DB4fB8bdc5a"
    factory: "0x9ac45538c6d27178650b3a50e39Afe9f0Db26Ca8"
  
  agent:
    private_key: ${AI_AGENT_PRIVATE_KEY}
    address: ${AI_AGENT_ADDRESS}
    
  execution:
    min_royalty_amount: 100  # USDC
    rebalance_threshold: 0.02
    gas_limit: 500000
    max_gas_price: 20  # gwei
    
  monitoring:
    check_interval: 300  # 5 minutes
    discovery_enabled: true
    auto_optimize: true
```

## 🚀 Activation Steps

1. **Update Environment:**
```bash
cd AI-VAULTS-main
cp .env.example .env
# Add all the environment variables above
```

2. **Test Live Connection:**
```bash
node scripts/live/test-live-connection.js
```

3. **Discover RoyaltyVaults:**
```bash
node scripts/live/discover-royalty-vaults.js
```

4. **Start AI Agent:**
```bash
# In your praha-main-2 repo
python src/main.py --config=story_protocol
```

## 🎯 Success Metrics

- ✅ Connection to Story Protocol established
- ✅ Live contracts verified and accessible
- ✅ AI agent can read contract state
- ✅ RoyaltyVaults discovered and monitored
- ✅ First optimization transaction executed

## 🔧 Troubleshooting

**Connection Issues:**
- Verify RPC URL is correct
- Check network connectivity
- Ensure private key has gas

**Contract Issues:**
- Verify contract addresses in deployments.json
- Check contract verification on Storyscan
- Test with read-only calls first

**Agent Authorization:**
- Ensure AI agent has AGENT_ROLE
- Check role assignments with hasRole()
- Verify gas limits and prices
