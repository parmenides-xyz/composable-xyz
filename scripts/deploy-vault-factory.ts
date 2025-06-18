#!/usr/bin/env node

import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

interface DeploymentConfig {
  defaultManager?: string;
  defaultAgent?: string;
  treasury?: string;
  creationFee?: string; // in ETH
}

interface NetworkConfig {
  [networkName: string]: DeploymentConfig;
}

// Network-specific configurations
const networkConfigs: NetworkConfig = {
  // Flow networks
  flow: {
    creationFee: "0.01", // 0.01 FLOW
  },
  flowTestnet: {
    creationFee: "0.001", // 0.001 FLOW for testnet
  },
  // Rootstock networks
  rootstock: {
    creationFee: "0.0001", // 0.0001 RBTC (lower gas costs)
  },
  rootstockTestnet: {
    creationFee: "0.0001", // 0.0001 tRBTC
  },
  // Local/hardhat
  hardhat: {
    creationFee: "0.01",
  },
  localhost: {
    creationFee: "0.01",
  },
};

async function main() {
  console.log("🚀 Deploying VaultFactory...\n");

  try {
    // Get network info
    const network = await ethers.provider.getNetwork();
    const networkName = network.name === "unknown" ? "hardhat" : network.name;

    console.log(`🌐 Network: ${networkName} (chainId: ${network.chainId})`);

    // Get deployer
    const [deployer] = await ethers.getSigners();
    console.log(`👤 Deployer: ${deployer.address}`);
    console.log(
      `💰 Balance: ${ethers.formatEther(
        await ethers.provider.getBalance(deployer.address)
      )} ETH\n`
    );

    // Get network config
    const config = networkConfigs[networkName] || networkConfigs.hardhat;

    // Set deployment parameters (use deployer as default if not specified)
    const defaultManager = config.defaultManager || deployer.address;
    const defaultAgent = config.defaultAgent || deployer.address;
    const treasury = config.treasury || deployer.address;
    const creationFee = ethers.parseEther(config.creationFee || "0.01");

    console.log("📋 Deployment Parameters:");
    console.log("========================");
    console.log(`Default Manager: ${defaultManager}`);
    console.log(`Default Agent:   ${defaultAgent}`);
    console.log(`Treasury:        ${treasury}`);
    console.log(`Creation Fee:    ${ethers.formatEther(creationFee)} ETH\n`);

    // Deploy VaultFactory
    console.log("📦 Deploying VaultFactory...");
    const VaultFactoryFactory = await ethers.getContractFactory("VaultFactory");
    const vaultFactory = await VaultFactoryFactory.deploy(
      defaultManager,
      defaultAgent,
      treasury,
      creationFee
    );

    await vaultFactory.waitForDeployment();
    const vaultFactoryAddress = await vaultFactory.getAddress();

    console.log(`✅ VaultFactory deployed to: ${vaultFactoryAddress}\n`);

    // Verify deployment
    console.log("🔍 Verifying deployment...");
    const deployedDefaultManager = await vaultFactory.defaultManager();
    const deployedDefaultAgent = await vaultFactory.defaultAgent();
    const deployedTreasury = await vaultFactory.treasury();
    const deployedCreationFee = await vaultFactory.creationFee();
    const vaultCounter = await vaultFactory.vaultCounter();

    console.log(
      `   ✅ Default Manager: ${deployedDefaultManager === defaultManager}`
    );
    console.log(
      `   ✅ Default Agent: ${deployedDefaultAgent === defaultAgent}`
    );
    console.log(`   ✅ Treasury: ${deployedTreasury === treasury}`);
    console.log(`   ✅ Creation Fee: ${deployedCreationFee === creationFee}`);
    console.log(`   ✅ Initial Vault Counter: ${vaultCounter === 0n}\n`);

    // Create deployment info
    const deploymentInfo = {
      network: networkName,
      chainId: network.chainId.toString(),
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      contracts: {
        vaultFactory: vaultFactoryAddress,
      },
      config: {
        defaultManager,
        defaultAgent,
        treasury,
        creationFee: ethers.formatEther(creationFee),
      },
      gasUsed: {
        // This would be filled by the actual deployment transaction
        vaultFactory: "TBD",
      },
    };

    // Save deployment info
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const deploymentFile = path.join(
      deploymentsDir,
      `vault-factory-${networkName}.json`
    );
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

    console.log(`📄 Deployment info saved to: ${deploymentFile}`);

    // Update main deployments.json if it exists
    const mainDeploymentsFile = path.join(__dirname, "..", "deployments.json");
    if (fs.existsSync(mainDeploymentsFile)) {
      const mainDeployments = JSON.parse(
        fs.readFileSync(mainDeploymentsFile, "utf8")
      );
      if (!mainDeployments[networkName]) {
        mainDeployments[networkName] = {};
      }
      mainDeployments[networkName].vaultFactory = vaultFactoryAddress;
      fs.writeFileSync(
        mainDeploymentsFile,
        JSON.stringify(mainDeployments, null, 2)
      );
      console.log(`📄 Updated main deployments.json`);
    }

    console.log("\n🎉 VaultFactory deployment completed successfully!");
    console.log("\n📖 Next steps:");
    console.log("1. Create vaults using the factory");
    console.log("2. Set up strategies for the vaults");
    console.log("3. Configure vault permissions as needed");
    console.log("\n💡 Example usage:");
    console.log(
      `npx hardhat run scripts/interact-vault-factory.ts --network ${networkName}`
    );
  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export default main;
