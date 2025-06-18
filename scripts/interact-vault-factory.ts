#!/usr/bin/env node

import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("🔗 Interacting with VaultFactory...\n");

  try {
    // Get network info
    const network = await ethers.provider.getNetwork();
    const networkName = network.name === "unknown" ? "hardhat" : network.name;

    console.log(`🌐 Network: ${networkName} (chainId: ${network.chainId})`);

    // Get signers
    const signers = await ethers.getSigners();
    const deployer = signers[0];

    // For real networks, we might only have one signer, so use deployer for all roles
    const user1 = signers[1] || deployer;
    const user2 = signers[2] || deployer;

    console.log(`👤 Deployer: ${deployer.address}`);
    if (signers.length > 1) {
      console.log(`👤 User1: ${user1.address}`);
      console.log(`👤 User2: ${user2.address}\n`);
    } else {
      console.log(
        `👤 Note: Using deployer for all operations (single signer setup)\n`
      );
    }

    // Load VaultFactory address
    let vaultFactoryAddress: string | undefined;

    // Try to load from deployment file
    const deploymentFile = path.join(
      __dirname,
      "..",
      "deployments",
      `vault-factory-${networkName}.json`
    );
    if (fs.existsSync(deploymentFile)) {
      const deploymentInfo = JSON.parse(
        fs.readFileSync(deploymentFile, "utf8")
      );
      vaultFactoryAddress = deploymentInfo.contracts.vaultFactory;
    } else {
      // Try to load from main deployments.json
      const mainDeploymentsFile = path.join(
        __dirname,
        "..",
        "deployments.json"
      );
      if (fs.existsSync(mainDeploymentsFile)) {
        const mainDeployments = JSON.parse(
          fs.readFileSync(mainDeploymentsFile, "utf8")
        );
        vaultFactoryAddress = mainDeployments[networkName]?.vaultFactory;
      }
    }

    if (!vaultFactoryAddress) {
      console.error(
        "❌ VaultFactory address not found. Please deploy first using:"
      );
      console.error(
        `npx hardhat run scripts/deploy-vault-factory.ts --network ${networkName}`
      );
      process.exit(1);
    }

    console.log(`🏭 VaultFactory Address: ${vaultFactoryAddress}\n`);

    // Connect to VaultFactory
    const vaultFactory = await ethers.getContractAt(
      "VaultFactory",
      vaultFactoryAddress
    );

    // Display current factory state
    console.log("📊 Current Factory State:");
    console.log("========================");
    const vaultCounter = await vaultFactory.vaultCounter();
    const defaultManager = await vaultFactory.defaultManager();
    const defaultAgent = await vaultFactory.defaultAgent();
    const treasury = await vaultFactory.treasury();
    const creationFee = await vaultFactory.creationFee();

    console.log(`Vault Counter: ${vaultCounter}`);
    console.log(`Default Manager: ${defaultManager}`);
    console.log(`Default Agent: ${defaultAgent}`);
    console.log(`Treasury: ${treasury}`);
    console.log(`Creation Fee: ${ethers.formatEther(creationFee)} ETH\n`);

    // Load existing tokens from deployments
    console.log("📋 Loading existing tokens...");
    const mainDeploymentsFile = path.join(__dirname, "..", "deployments.json");
    let deployments: any = {};

    if (fs.existsSync(mainDeploymentsFile)) {
      deployments = JSON.parse(fs.readFileSync(mainDeploymentsFile, "utf8"));
    }

    const networkChains = deployments.chains?.[networkName] || {};
    const availableTokens = networkChains.tokens || {};

    console.log(`Available tokens on ${networkName}:`);
    Object.entries(availableTokens).forEach(([name, address]) => {
      console.log(`  ${name}: ${address}`);
    });

    // Use the first available token, or create a new one if none exist
    let mockTokenAddress: string;
    let tokenName: string;

    const tokenEntries = Object.entries(availableTokens);
    if (tokenEntries.length > 0) {
      // Use existing token
      const [firstTokenName, firstTokenAddress] = tokenEntries[0] as [
        string,
        string
      ];
      mockTokenAddress = firstTokenAddress;
      tokenName = firstTokenName;
      console.log(
        `✅ Using existing token: ${tokenName} at ${mockTokenAddress}\n`
      );
    } else {
      // Deploy a new token if none exist
      console.log("📦 No existing tokens found, deploying new mock token...");
      const MockERC20Factory = await ethers.getContractFactory("MockERC20");
      const mockToken = await MockERC20Factory.deploy("Test Token", "TEST", 18);
      await mockToken.waitForDeployment();
      mockTokenAddress = await mockToken.getAddress();
      tokenName = "Test Token";
      console.log(`✅ New Mock Token deployed to: ${mockTokenAddress}\n`);
    }

    // Create a vault with default settings
    console.log("🏗️  Creating vault with default settings...");
    const tx1 = await vaultFactory
      .connect(user1)
      .createVaultWithDefaults(
        mockTokenAddress,
        `${tokenName} Vault 1`,
        "TV1",
        { value: creationFee }
      );

    const receipt1 = await tx1.wait();
    const event1 = receipt1?.logs.find((log) => {
      try {
        return vaultFactory.interface.parseLog(log)?.name === "VaultCreated";
      } catch {
        return false;
      }
    });

    if (event1) {
      const parsedEvent1 = vaultFactory.interface.parseLog(event1);
      const vaultId1 = parsedEvent1?.args[0];
      const vaultAddress1 = parsedEvent1?.args[1];
      console.log(
        `✅ Vault 1 created with ID: ${vaultId1}, Address: ${vaultAddress1}\n`
      );
    }

    // Create a vault with custom settings
    console.log("🏗️  Creating vault with custom settings...");
    const vaultParams = {
      asset: mockTokenAddress,
      name: `Custom ${tokenName} Vault 2`,
      symbol: "CV2",
      manager: user1.address,
      agent: user2.address,
    };

    const tx2 = await vaultFactory.connect(user2).createVault(vaultParams, {
      value: creationFee,
    });

    const receipt2 = await tx2.wait();
    const event2 = receipt2?.logs.find((log) => {
      try {
        return vaultFactory.interface.parseLog(log)?.name === "VaultCreated";
      } catch {
        return false;
      }
    });

    if (event2) {
      const parsedEvent2 = vaultFactory.interface.parseLog(event2);
      const vaultId2 = parsedEvent2?.args[0];
      const vaultAddress2 = parsedEvent2?.args[1];
      console.log(
        `✅ Vault 2 created with ID: ${vaultId2}, Address: ${vaultAddress2}\n`
      );
    }

    // Display updated factory state
    console.log("📊 Updated Factory State:");
    console.log("=========================");
    const newVaultCounter = await vaultFactory.vaultCounter();
    console.log(`Vault Counter: ${newVaultCounter}`);

    const allVaults = await vaultFactory.getAllVaults();
    console.log(`Total Vaults: ${allVaults.length}`);

    for (let i = 0; i < allVaults.length; i++) {
      console.log(`  Vault ${i + 1}: ${allVaults[i]}`);
    }

    // Get vaults for the test token
    const vaultsForAsset = await vaultFactory.getVaultsForAsset(
      mockTokenAddress
    );
    console.log(`\nVaults for ${mockTokenAddress}: ${vaultsForAsset.length}`);

    // Get detailed info for each vault
    console.log("\n📋 Vault Details:");
    console.log("==================");
    for (let i = 1; i <= newVaultCounter; i++) {
      const vaultInfo = await vaultFactory.getVaultInfo(i);
      console.log(`Vault ${i}:`);
      console.log(`  Address: ${vaultInfo.vaultAddress}`);
      console.log(`  Asset: ${vaultInfo.asset}`);
      console.log(`  Name: ${vaultInfo.name}`);
      console.log(`  Symbol: ${vaultInfo.symbol}`);
      console.log(
        `  Is from factory: ${await vaultFactory.isVaultCreatedByFactory(
          vaultInfo.vaultAddress
        )}`
      );
      console.log("");
    }

    // Test vault functionality
    if (allVaults.length > 0) {
      console.log("🧪 Testing vault functionality...");
      const firstVaultAddress = allVaults[0];
      const vault = await ethers.getContractAt("Vault", firstVaultAddress);

      console.log(`Testing vault at: ${firstVaultAddress}`);
      console.log(`Vault name: ${await vault.name()}`);
      console.log(`Vault symbol: ${await vault.symbol()}`);
      console.log(`Vault asset: ${await vault.asset()}`);
      console.log(`Total assets: ${await vault.totalAssets()}`);
      console.log(`Total supply: ${await vault.totalSupply()}\n`);
    }

    // Display treasury balance
    const treasuryBalance = await ethers.provider.getBalance(treasury);
    console.log(
      `💰 Treasury Balance: ${ethers.formatEther(treasuryBalance)} ETH`
    );

    console.log("\n🎉 VaultFactory interaction completed successfully!");
    console.log("\n📖 Summary:");
    console.log(`- Created ${newVaultCounter} vaults`);
    console.log(`- All vaults use asset: ${mockTokenAddress}`);
    console.log(
      `- Treasury received fees: ${ethers.formatEther(
        creationFee * BigInt(newVaultCounter)
      )} ETH`
    );
  } catch (error) {
    console.error("❌ Interaction failed:", error);
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
