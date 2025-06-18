import { ethers, network } from "hardhat";
import fs from "fs";
import path from "path";

interface TokenConfig {
  decimals: number;
  priceId: string;
  faucetAmount: string;
}

interface ChainConfig {
  chainId: number;
  pyth: string;
  tokens: Record<string, string>;
  vaults: Record<string, string>;
}

interface DeploymentData {
  chains: Record<string, ChainConfig>;
  priceIds: Record<string, string>;
  tokenConfig: Record<string, TokenConfig>;
}

const DEPLOYMENTS_FILE = path.join(__dirname, "../deployments.json");

// Load deployment data
function loadDeployments(): DeploymentData {
  if (!fs.existsSync(DEPLOYMENTS_FILE)) {
    throw new Error(`Deployments file not found: ${DEPLOYMENTS_FILE}`);
  }
  return JSON.parse(fs.readFileSync(DEPLOYMENTS_FILE, "utf8"));
}

async function main() {
  const networkName = network.name;
  console.log(`📊 Vault Status Check on ${networkName}`);
  console.log("=" + "=".repeat(30 + networkName.length));

  // Load deployment data
  const deploymentData = loadDeployments();
  const chainConfig = deploymentData.chains[networkName];

  if (!chainConfig) {
    console.log(`❌ Network ${networkName} not configured in deployments.json`);
    console.log(
      `Available networks: ${Object.keys(deploymentData.chains).join(", ")}`
    );
    return;
  }

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log(`\n👤 Account: ${deployer.address}`);
  console.log(
    `💰 Balance: ${ethers.formatEther(
      await deployer.provider.getBalance(deployer.address)
    )} ETH`
  );
  console.log(`🔗 Chain ID: ${chainConfig.chainId}`);
  console.log(`🔮 Pyth Oracle: ${chainConfig.pyth}\n`);

  // Check if contracts are deployed
  console.log("📋 Deployment Status:");
  console.log("========================");

  // Check tokens
  const tokenNames = ["MockUSDC", "MockWBTC", "MockWETH"];
  let allTokensDeployed = true;

  for (const tokenName of tokenNames) {
    const tokenAddress = chainConfig.tokens[tokenName];
    if (tokenAddress) {
      try {
        const token = await ethers.getContractAt(tokenName, tokenAddress);
        const symbol = await token.symbol();
        const decimals = await token.decimals();
        console.log(
          `✅ ${tokenName}: ${tokenAddress} (${symbol}, ${decimals} decimals)`
        );
      } catch (error) {
        console.log(
          `⚠️  ${tokenName}: ${tokenAddress} (deployment verification failed)`
        );
      }
    } else {
      console.log(`❌ ${tokenName}: Not deployed`);
      allTokensDeployed = false;
    }
  }

  // Check vault
  const vaultAddress = chainConfig.vaults.MultiTokenVault;
  let vaultDeployed = false;
  if (vaultAddress) {
    try {
      const vault = await ethers.getContractAt("MultiTokenVault", vaultAddress);
      const vaultName = await vault.name();
      const vaultSymbol = await vault.symbol();
      const totalAssets = await vault.totalAssets();
      const totalSupply = await vault.totalSupply();
      console.log(`✅ MultiTokenVault: ${vaultAddress}`);
      console.log(`   Name: ${vaultName} (${vaultSymbol})`);
      console.log(
        `   Total Assets: ${ethers.formatUnits(totalAssets, 6)} USDC`
      );
      console.log(
        `   Total Supply: ${ethers.formatUnits(totalSupply, 6)} ${vaultSymbol}`
      );
      vaultDeployed = true;
    } catch (error) {
      console.log(
        `⚠️  MultiTokenVault: ${vaultAddress} (deployment verification failed)`
      );
    }
  } else {
    console.log(`❌ MultiTokenVault: Not deployed`);
  }

  if (!allTokensDeployed || !vaultDeployed) {
    console.log(`\n💡 To deploy missing contracts, run:`);
    console.log(
      `   npx hardhat run scripts/deploy-vault-system.ts --network ${networkName}`
    );
    return;
  }

  // Check user balances
  console.log(`\n💰 Account Balances:`);
  console.log("===================");

  for (const tokenName of tokenNames) {
    const tokenAddress = chainConfig.tokens[tokenName];
    const config = deploymentData.tokenConfig[tokenName];
    try {
      const token = await ethers.getContractAt(tokenName, tokenAddress);
      const balance = await token.balanceOf(deployer.address);
      const formattedBalance = ethers.formatUnits(balance, config.decimals);
      const symbol = await token.symbol();
      console.log(`  • ${symbol}: ${formattedBalance}`);
    } catch (error) {
      console.log(`  • ${tokenName}: Error reading balance`);
    }
  }

  // Check vault shares
  try {
    const vault = await ethers.getContractAt("MultiTokenVault", vaultAddress);
    const vaultShares = await vault.balanceOf(deployer.address);
    const vaultSymbol = await vault.symbol();
    console.log(`  • ${vaultSymbol}: ${ethers.formatUnits(vaultShares, 6)}`);
  } catch (error) {
    console.log(`  • Vault Shares: Error reading balance`);
  }

  // Check token configurations in vault
  console.log(`\n⚙️  Token Configuration in Vault:`);
  console.log("=================================");

  const vault = await ethers.getContractAt("MultiTokenVault", vaultAddress);

  for (const tokenName of tokenNames) {
    const tokenAddress = chainConfig.tokens[tokenName];
    try {
      const config = await vault.acceptedTokens(tokenAddress);
      const expectedPriceId =
        tokenName === "MockUSDC"
          ? "0x0000000000000000000000000000000000000000000000000000000000000000"
          : deploymentData.priceIds[
              deploymentData.tokenConfig[tokenName].priceId
            ];

      const symbol = await (
        await ethers.getContractAt(tokenName, tokenAddress)
      ).symbol();
      console.log(`  • ${symbol}:`);
      console.log(`    - Accepted: ${config.isAccepted ? "✅" : "❌"}`);
      console.log(`    - Decimals: ${config.decimals}`);
      console.log(
        `    - Price ID: ${
          config.priceId === expectedPriceId ? "✅" : "⚠️"
        } ${config.priceId.slice(0, 10)}...`
      );
    } catch (error) {
      console.log(`  • ${tokenName}: Error reading configuration`);
    }
  }

  // Test oracle functionality
  console.log(`\n🔮 Oracle Status:`);
  console.log("================");

  // Test USDC (should always work)
  try {
    const testAmount = ethers.parseUnits("1000", 6);
    const preview = await vault.previewTokenDeposit(
      chainConfig.tokens.MockUSDC,
      testAmount
    );
    console.log(
      `  • USDC Oracle: ✅ (1000 USDC → ${ethers.formatUnits(preview, 6)} USDC)`
    );
  } catch (error) {
    console.log(`  • USDC Oracle: ❌ (Error: Basic functionality failed)`);
  }

  // Test WBTC
  try {
    const testAmount = ethers.parseUnits("0.01", 8);
    const preview = await vault.previewTokenDeposit(
      chainConfig.tokens.MockWBTC,
      testAmount
    );
    console.log(
      `  • WBTC Oracle: ✅ (0.01 WBTC → ${ethers.formatUnits(preview, 6)} USDC)`
    );
  } catch (error) {
    console.log(`  • WBTC Oracle: ❌ (Likely stale price data)`);
  }

  // Test WETH
  try {
    const testAmount = ethers.parseUnits("0.1", 18);
    const preview = await vault.previewTokenDeposit(
      chainConfig.tokens.MockWETH,
      testAmount
    );
    console.log(
      `  • WETH Oracle: ✅ (0.1 WETH → ${ethers.formatUnits(preview, 6)} USDC)`
    );
  } catch (error) {
    console.log(`  • WETH Oracle: ❌ (Likely stale price data)`);
  }

  // Summary and next steps
  console.log(`\n🎯 Next Steps:`);
  console.log("==============");
  console.log(
    `1. Get test tokens: npx hardhat run scripts/get-test-tokens.ts --network ${networkName}`
  );
  console.log(
    `2. Interact with vault: npx hardhat run scripts/interact-vault.ts --network ${networkName}`
  );
  console.log(
    `3. Deploy on new network: npx hardhat run scripts/deploy-vault-system.ts --network <network>`
  );

  console.log(`\n✨ Status check completed!`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Status check failed:", error);
    process.exit(1);
  });
