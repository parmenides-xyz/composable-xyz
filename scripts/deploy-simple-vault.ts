import { ethers, network } from "hardhat";
import fs from "fs";
import path from "path";

interface ChainConfig {
  chainId: number;
  tokens: Record<string, string>;
  vaults: Record<string, string>;
}

interface DeploymentData {
  chains: Record<string, ChainConfig>;
  tokenConfig: Record<string, any>;
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
  console.log(`🚀 Deploying Simple Vault System on ${networkName}`);
  console.log("==================================================");

  // Load deployment data
  const deploymentData = loadDeployments();
  let chainConfig = deploymentData.chains[networkName];

  if (!chainConfig) {
    console.log(
      `⚠️  Network ${networkName} not configured, creating new configuration...`
    );
    chainConfig = {
      chainId: network.config.chainId || 0,
      tokens: {},
      vaults: {},
    };
    deploymentData.chains[networkName] = chainConfig;
  }

  console.log(`🔗 Chain ID: ${chainConfig.chainId}`);

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(
    `💰 Balance: ${ethers.formatEther(
      await deployer.provider.getBalance(deployer.address)
    )} ${networkName.includes("rootstock") ? "RBTC" : "ETH"}\n`
  );

  // Deploy MockUSDC if not already deployed
  console.log("🪙 Checking MockUSDC...");
  if (!chainConfig.tokens.MockUSDC) {
    console.log("   Deploying MockUSDC...");
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDCFactory.deploy();
    await mockUSDC.waitForDeployment();

    const usdcAddress = await mockUSDC.getAddress();
    chainConfig.tokens.MockUSDC = usdcAddress;

    console.log(`   ✅ MockUSDC: ${usdcAddress}`);
  } else {
    console.log(
      `   ✅ MockUSDC: ${chainConfig.tokens.MockUSDC} (already deployed)`
    );
  }

  // Deploy Simple Vault if not already deployed
  console.log("\n🏦 Checking Simple Vault...");
  if (!chainConfig.vaults.Vault) {
    console.log("   Deploying Simple Vault...");

    const VaultFactory = await ethers.getContractFactory("Vault");
    const vault = await VaultFactory.deploy(
      chainConfig.tokens.MockUSDC, // USDC address as underlying asset
      "Simple USDC Vault", // Name
      "sUSDC", // Symbol
      deployer.address, // Manager
      deployer.address // Agent
    );
    await vault.waitForDeployment();

    const vaultAddress = await vault.getAddress();
    chainConfig.vaults.Vault = vaultAddress;

    console.log(`   ✅ Simple Vault: ${vaultAddress}`);
  } else {
    console.log(
      `   ✅ Simple Vault: ${chainConfig.vaults.Vault} (already deployed)`
    );
  }

  // Mint test USDC to deployer
  console.log("\n💰 Minting Test USDC to Deployer...");
  const mockUSDC = await ethers.getContractAt(
    "MockUSDC",
    chainConfig.tokens.MockUSDC
  );

  try {
    const currentBalance = await mockUSDC.balanceOf(deployer.address);
    const faucetAmount = ethers.parseUnits("10000", 6); // 10,000 USDC

    if (currentBalance < faucetAmount) {
      console.log("   Minting 10,000 USDC...");
      const mintTx = await mockUSDC.faucet(faucetAmount);
      await mintTx.wait();
      console.log("   ✅ Minted 10,000 USDC");
    } else {
      console.log(
        `   ✅ USDC balance sufficient: ${ethers.formatUnits(
          currentBalance,
          6
        )} USDC`
      );
    }
  } catch (error: any) {
    console.log(`   ⚠️  Error minting USDC: ${error.message}`);
  }

  // Save updated deployment data
  deploymentData.chains[networkName] = chainConfig;
  saveDeployments(deploymentData);

  // Final status
  console.log("\n📊 Deployment Summary:");
  console.log("==================================================");
  console.log(`Network: ${networkName}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log("\nTokens:");
  console.log(`  • MockUSDC: ${chainConfig.tokens.MockUSDC}`);
  console.log("\nVaults:");
  console.log(`  • Simple Vault: ${chainConfig.vaults.Vault}`);

  console.log("\n🎯 Next Steps:");
  console.log(
    "1. Get tokens: npx hardhat run scripts/get-simple-vault-tokens.ts --network " +
      networkName
  );
  console.log(
    "2. Interact: npx hardhat run scripts/interact-simple-vault.ts --network " +
      networkName
  );
  console.log(
    "3. Check status: npx hardhat run scripts/simple-vault-status.ts --network " +
      networkName
  );

  console.log("\n✨ Simple Vault deployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
