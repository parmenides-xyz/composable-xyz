import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.13",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1,  // Low runs for smaller contract size
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      chainId: 31337,
      // Fork Story Protocol testnet for testing
      forking: {
        url: process.env.STORY_RPC_URL || "https://mainnet.storyrpc.io",
        enabled: false // Set to true to enable forking
      }
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    // Story Protocol networks
    story: {
      url: process.env.STORY_RPC_URL || "https://mainnet.storyrpc.io",
      accounts: process.env.PRIV_KEY ? [process.env.PRIV_KEY] : [],
      chainId: 1514,
    },
    storyTestnet: {
      url: process.env.STORY_TESTNET_RPC_URL || "https://story-network-testnet.rpc.caldera.xyz/http",
      accounts: process.env.PRIV_KEY ? [process.env.PRIV_KEY] : [],
      chainId: 1512,
    },
    ethereum: {
      url: process.env.ETHEREUM_RPC_URL || "https://eth-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY",
      accounts: process.env.PRIV_KEY ? [process.env.PRIV_KEY] : [],
      chainId: 1
    },
    base: {
      url: "https://mainnet.base.org",
      accounts: process.env.PRIV_KEY ? [process.env.PRIV_KEY] : [],
      chainId: 8453
    }
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY,
      base: process.env.BASESCAN_API_KEY
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};

export default config;
