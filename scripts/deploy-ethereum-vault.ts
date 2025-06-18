import { ethers, network } from "hardhat";
import fs from "fs";
import path from "path";

const DEPLOYMENTS_FILE = path.join(__dirname, "../deployments.json");

function loadDeployments() {
  if (!fs.existsSync(DEPLOYMENTS_FILE)) {
    throw new Error(`Deployments file not found: ${DEPLOYMENTS_FILE}`);
  }
  return JSON.parse(fs.readFileSync(DEPLOYMENTS_FILE, "utf8"));
}

function saveDeployments(data: any): void {
  fs.writeFileSync(DEPLOYMENTS_FILE, JSON.stringify(data, null, 2));
  console.log(`✅ Updated deployments.json`);
}

async function main() {
  const networkName = network.name;
  console.log(`🚀 Deploying Vault System on Ethereum ${networkName}`);
  console.log("====================================================");

  if (networkName !== "ethereum" && networkName !== "mainnet") {
    throw new Error("This script should only be run on Ethereum mainnet");
  }

  // Load deployment data
  const deploymentData = loadDeployments();
  
  // Initialize ethereum chain config if it doesn't exist
  if (!deploymentData.chains.ethereum) {
    deploymentData.chains.ethereum = {
      chainId: 1,
      pyth: "0x4305FB66699C3B2702D4d05CF36551390A4c69C6", // Pyth on Ethereum
      tokens: {},
      vaults: {}
    };
  }
  
  const chainConfig = deploymentData.chains.ethereum;

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(`💰 Balance: ${ethers.formatEther(
    await deployer.provider.getBalance(deployer.address)
  )} ETH\n`);

  // Real addresses on Ethereum
  const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const PYTH_ADDRESS = "0x4305FB66699C3B2702D4d05CF36551390A4c69C6";
  const DEBRIDGE_GATE = "0x43dE2d77BF8027e25dBD179B491e8d64f38398aA"; // deBridge Gate on Ethereum

  console.log(`💰 Using USDC: ${USDC_ADDRESS}`);
  console.log(`🔮 Using Pyth Oracle: ${PYTH_ADDRESS}`);
  console.log(`🌉 Using deBridge Gate: ${DEBRIDGE_GATE}\n`);

  // Deploy main Vault for Story Protocol royalties → Ethereum DeFi
  console.log("🏦 Deploying Main Vault for Story Protocol Integration...");
  const VaultFactory = await ethers.getContractFactory("Vault");
  const vault = await VaultFactory.deploy(
    USDC_ADDRESS,        // asset (USDC)
    "Story Royalty Vault", // name
    "srvUSDC",           // symbol
    deployer.address,    // manager
    deployer.address,    // agent (AI agent address)
    DEBRIDGE_GATE        // deBridge gate
  );

  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();

  console.log(`✅ Main Vault deployed: ${vaultAddress}`);

  // Deploy Aave V3 Strategy
  console.log("\n📈 Deploying Aave V3 Strategy...");
  const AaveStrategyFactory = await ethers.getContractFactory("AaveV3Strategy");
  const aaveStrategy = await AaveStrategyFactory.deploy(vaultAddress);

  await aaveStrategy.waitForDeployment();
  const aaveStrategyAddress = await aaveStrategy.getAddress();

  console.log(`✅ Aave V3 Strategy deployed: ${aaveStrategyAddress}`);

  // Deploy Compound V3 Strategy
  console.log("\n📈 Deploying Compound V3 Strategy...");
  const CompoundStrategyFactory = await ethers.getContractFactory("CompoundV3Strategy");
  const compoundStrategy = await CompoundStrategyFactory.deploy(vaultAddress);

  await compoundStrategy.waitForDeployment();
  const compoundStrategyAddress = await compoundStrategy.getAddress();

  console.log(`✅ Compound V3 Strategy deployed: ${compoundStrategyAddress}`);

  // Add strategies to vault
  console.log("\n⚙️  Adding strategies to vault...");
  
  try {
    // Add strategies to vault (vault is already set in constructor)
    console.log("   Adding Aave strategy to vault...");
    const addAave = await vault.addStrategy(aaveStrategyAddress);
    await addAave.wait();
    
    console.log("   Adding Compound strategy to vault...");
    const addCompound = await vault.addStrategy(compoundStrategyAddress);
    await addCompound.wait();
    
    console.log("   ✅ All strategies added successfully");
  } catch (error: any) {
    console.log(`   ⚠️  Error setting up strategies: ${error.message}`);
  }

  // Update deployment data
  chainConfig.tokens.USDC = USDC_ADDRESS;
  chainConfig.vaults.MainVault = vaultAddress;
  chainConfig.vaults.AaveV3Strategy = aaveStrategyAddress;
  chainConfig.vaults.CompoundV3Strategy = compoundStrategyAddress;
  
  deploymentData.chains.ethereum = chainConfig;
  saveDeployments(deploymentData);

  // Verify deployment
  console.log("\n🔍 Verifying deployment...");
  try {
    const vaultAsset = await vault.asset();
    const vaultName = await vault.name();
    const strategies = await vault.getStrategies();
    
    console.log(`   ✅ Vault Asset: ${vaultAsset}`);
    console.log(`   ✅ Vault Name: ${vaultName}`);
    console.log(`   ✅ Strategies Count: ${strategies.length}`);
    
    for (let i = 0; i < strategies.length; i++) {
      console.log(`      Strategy ${i}: ${strategies[i]}`);
    }
  } catch (error: any) {
    console.log(`   ⚠️  Verification failed: ${error.message}`);
  }

  // Final summary
  console.log("\n📊 Ethereum Deployment Summary:");
  console.log("====================================================");
  console.log(`Network: ${networkName} (Chain ID: 1)`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`USDC Token: ${USDC_ADDRESS}`);
  console.log(`Pyth Oracle: ${PYTH_ADDRESS}`);
  console.log(`Main Vault: ${vaultAddress}`);
  console.log(`Aave V3 Strategy: ${aaveStrategyAddress}`);
  console.log(`Compound V3 Strategy: ${compoundStrategyAddress}`);

  console.log("\n🎯 Ready for Story Protocol Integration:");
  console.log("1. ✅ Ethereum vault deployed with DeFi strategies");
  console.log("2. ✅ Ready to receive bridged tokens from Story Protocol");
  console.log("3. ✅ AI agent can optimize yields across Aave + Compound");
  console.log("4. 🔄 Next: Update RoyaltyYieldWrapper to point to this vault");
  
  console.log("\n✨ Ethereum vault deployment successful!");
  console.log("🌉 Ready for Story → Ethereum yield optimization flow!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });