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

// Save deployment data
function saveDeployments(data: DeploymentData): void {
  fs.writeFileSync(DEPLOYMENTS_FILE, JSON.stringify(data, null, 2));
  console.log(`✅ Updated deployments.json`);
}

// Get network name from hardhat
function getNetworkName(): string {
  return network.name;
}

async function main() {
  const networkName = getNetworkName();
  console.log(`🚀 Deploying Vault System on ${networkName}`);
  console.log("==================================================");

  // Load deployment data
  const deploymentData = loadDeployments();
  const chainConfig = deploymentData.chains[networkName];

  if (!chainConfig) {
    throw new Error(
      `Network ${networkName} not configured in deployments.json`
    );
  }

  console.log(`🔗 Chain ID: ${chainConfig.chainId}`);
  console.log(`🔮 Pyth Oracle: ${chainConfig.pyth}\n`);

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(
    `💰 Balance: ${ethers.formatEther(
      await deployer.provider.getBalance(deployer.address)
    )} ETH\n`
  );

  let tokensDeployed = false;
  let vaultDeployed = false;

  // Deploy mock tokens if not already deployed
  console.log("🪙 Checking Mock Tokens...");
  const tokenNames = ["MockUSDC", "MockWBTC", "MockWETH"];

  for (const tokenName of tokenNames) {
    if (!chainConfig.tokens[tokenName]) {
      console.log(`   Deploying ${tokenName}...`);
      const TokenFactory = await ethers.getContractFactory(tokenName);
      const token = await TokenFactory.deploy();
      await token.waitForDeployment();

      const tokenAddress = await token.getAddress();
      chainConfig.tokens[tokenName] = tokenAddress;
      tokensDeployed = true;

      console.log(`   ✅ ${tokenName}: ${tokenAddress}`);
    } else {
      console.log(
        `   ✅ ${tokenName}: ${chainConfig.tokens[tokenName]} (already deployed)`
      );
    }
  }

  // Deploy MultiTokenVault if not already deployed
  console.log("\n🏦 Checking MultiTokenVault...");
  if (!chainConfig.vaults.MultiTokenVault) {
    console.log("   Deploying MultiTokenVault...");

    const VaultFactory = await ethers.getContractFactory("MultiTokenVault");
    const vault = await VaultFactory.deploy(
      chainConfig.tokens.MockUSDC, // USDC address
      deployer.address, // Manager
      deployer.address, // Agent
      chainConfig.pyth, // Pyth oracle
      "Multi-Token Vault", // Name
      "mtvUSDC" // Symbol
    );
    await vault.waitForDeployment();

    const vaultAddress = await vault.getAddress();
    chainConfig.vaults.MultiTokenVault = vaultAddress;
    vaultDeployed = true;

    console.log(`   ✅ MultiTokenVault: ${vaultAddress}`);
  } else {
    console.log(
      `   ✅ MultiTokenVault: ${chainConfig.vaults.MultiTokenVault} (already deployed)`
    );
  }

  // Configure tokens in vault (always do this to ensure correct configuration)
  console.log("\n⚙️  Configuring Tokens in Vault...");
  const vault = await ethers.getContractAt(
    "MultiTokenVault",
    chainConfig.vaults.MultiTokenVault
  );

  for (const tokenName of tokenNames) {
    const tokenAddress = chainConfig.tokens[tokenName];
    const config = deploymentData.tokenConfig[tokenName];
    const priceId =
      tokenName === "MockUSDC"
        ? "0x0000000000000000000000000000000000000000000000000000000000000000"
        : deploymentData.priceIds[config.priceId];

    try {
      // Check if already configured
      const currentConfig = await vault.acceptedTokens(tokenAddress);
      if (!currentConfig.isAccepted) {
        console.log(`   Configuring ${tokenName}...`);
        const configTx = await vault.configureToken(
          tokenAddress,
          priceId,
          config.decimals
        );
        await configTx.wait();
        console.log(`   ✅ ${tokenName} configured`);
      } else {
        console.log(`   ✅ ${tokenName} already configured`);
      }
    } catch (error: any) {
      console.log(`   ⚠️  Error configuring ${tokenName}: ${error.message}`);
    }
  }

  // Mint test tokens to deployer
  console.log("\n💰 Minting Test Tokens to Deployer...");
  for (const tokenName of tokenNames) {
    const tokenAddress = chainConfig.tokens[tokenName];
    const config = deploymentData.tokenConfig[tokenName];
    const token = await ethers.getContractAt(tokenName, tokenAddress);

    try {
      const currentBalance = await token.balanceOf(deployer.address);
      const faucetAmount = ethers.parseUnits(
        config.faucetAmount,
        config.decimals
      );

      // Only mint if balance is low
      if (currentBalance < faucetAmount) {
        console.log(`   Minting ${config.faucetAmount} ${tokenName}...`);
        const mintTx = await token.faucet(faucetAmount);
        await mintTx.wait();
        console.log(`   ✅ Minted ${config.faucetAmount} ${tokenName}`);
      } else {
        console.log(
          `   ✅ ${tokenName} balance sufficient: ${ethers.formatUnits(
            currentBalance,
            config.decimals
          )}`
        );
      }
    } catch (error: any) {
      console.log(`   ⚠️  Error minting ${tokenName}: ${error.message}`);
    }
  }

  // Save updated deployment data
  deploymentData.chains[networkName] = chainConfig;
  saveDeployments(deploymentData);

  // Final status
  console.log("\n📊 Deployment Summary:");
  console.log("==================================================");
  console.log(`Network: ${networkName}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Pyth Oracle: ${chainConfig.pyth}`);
  console.log("\nTokens:");
  for (const tokenName of tokenNames) {
    console.log(`  • ${tokenName}: ${chainConfig.tokens[tokenName]}`);
  }
  console.log("\nVaults:");
  console.log(`  • MultiTokenVault: ${chainConfig.vaults.MultiTokenVault}`);

  console.log("\n🎯 Next Steps:");
  console.log(
    "1. Run tests: npx hardhat run scripts/test-vault.ts --network " +
      networkName
  );
  console.log(
    "2. Interact: npx hardhat run scripts/interact-vault.ts --network " +
      networkName
  );
  console.log(
    "3. Check status: npx hardhat run scripts/vault-status.ts --network " +
      networkName
  );

  console.log("\n✨ Deployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
