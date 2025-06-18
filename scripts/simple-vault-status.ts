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
  console.log(`📊 Simple Vault Status Check on ${networkName}`);
  console.log("=======================================");

  // Load deployment data
  const deploymentData = loadDeployments();
  const chainConfig = deploymentData.chains[networkName];

  if (!chainConfig) {
    console.log(`❌ Network ${networkName} not configured in deployments.json`);
    console.log(
      "Available networks:",
      Object.keys(deploymentData.chains).join(", ")
    );
    return;
  }

  // Get signer
  const [signer] = await ethers.getSigners();
  console.log(`👤 Account: ${signer.address}`);
  console.log(
    `💰 Native Balance: ${ethers.formatEther(
      await signer.provider.getBalance(signer.address)
    )} ${networkName.includes("rootstock") ? "RBTC" : "ETH"}\n`
  );

  // Check contract deployments
  console.log("🏗️ Contract Deployments:");
  console.log("========================");

  // Check MockUSDC
  if (chainConfig.tokens.MockUSDC) {
    try {
      const mockUSDC = await ethers.getContractAt(
        "MockUSDC",
        chainConfig.tokens.MockUSDC
      );
      const name = await mockUSDC.name();
      const symbol = await mockUSDC.symbol();
      const decimals = await mockUSDC.decimals();
      console.log(
        `✅ MockUSDC: ${chainConfig.tokens.MockUSDC} (${name}, ${symbol}, ${decimals} decimals)`
      );
    } catch (error) {
      console.log(
        `❌ MockUSDC: ${chainConfig.tokens.MockUSDC} (contract error)`
      );
    }
  } else {
    console.log("❌ MockUSDC: Not deployed");
  }

  // Check Simple Vault
  if (chainConfig.vaults.Vault) {
    try {
      const vault = await ethers.getContractAt(
        "Vault",
        chainConfig.vaults.Vault
      );
      const name = await vault.name();
      const symbol = await vault.symbol();
      const asset = await vault.asset();
      const totalAssets = await vault.totalAssets();
      const totalSupply = await vault.totalSupply();

      console.log(`✅ Simple Vault: ${chainConfig.vaults.Vault}`);
      console.log(`   Name: ${name}`);
      console.log(`   Symbol: ${symbol}`);
      console.log(`   Asset: ${asset}`);
      console.log(
        `   Total Assets: ${ethers.formatUnits(totalAssets, 6)} USDC`
      );
      console.log(
        `   Total Supply: ${ethers.formatUnits(totalSupply, 18)} ${symbol}`
      );
    } catch (error) {
      console.log(
        `❌ Simple Vault: ${chainConfig.vaults.Vault} (contract error)`
      );
    }
  } else {
    console.log("❌ Simple Vault: Not deployed");
  }

  // Check account balances
  console.log("\n💰 Account Balances:");
  console.log("====================");

  if (chainConfig.tokens.MockUSDC) {
    try {
      const mockUSDC = await ethers.getContractAt(
        "MockUSDC",
        chainConfig.tokens.MockUSDC
      );
      const usdcBalance = await mockUSDC.balanceOf(signer.address);
      console.log(`  • USDC: ${ethers.formatUnits(usdcBalance, 6)}`);
    } catch (error) {
      console.log("  • USDC: Error fetching balance");
    }
  }

  if (chainConfig.vaults.Vault) {
    try {
      const vault = await ethers.getContractAt(
        "Vault",
        chainConfig.vaults.Vault
      );
      const vaultShares = await vault.balanceOf(signer.address);
      const symbol = await vault.symbol();
      console.log(`  • ${symbol}: ${ethers.formatUnits(vaultShares, 18)}`);
    } catch (error) {
      console.log("  • Vault Shares: Error fetching balance");
    }
  }

  // Check roles and permissions
  if (chainConfig.vaults.Vault) {
    console.log("\n🔐 Roles and Permissions:");
    console.log("=========================");

    try {
      const vault = await ethers.getContractAt(
        "Vault",
        chainConfig.vaults.Vault
      );
      const hasManagerRole = await vault.hasManagerRole(signer.address);
      const hasAgentRole = await vault.hasAgentRole(signer.address);

      console.log(`  • Manager Role: ${hasManagerRole ? "✅" : "❌"}`);
      console.log(`  • Agent Role: ${hasAgentRole ? "✅" : "❌"}`);
    } catch (error) {
      console.log("  • Error checking roles");
    }
  }

  // Recommendations
  console.log("\n🎯 Recommendations:");
  console.log("===================");

  if (!chainConfig.tokens.MockUSDC) {
    console.log("❗ Deploy MockUSDC first");
  } else if (!chainConfig.vaults.Vault) {
    console.log("❗ Deploy Simple Vault");
  } else {
    console.log("✅ All contracts deployed successfully!");

    if (chainConfig.tokens.MockUSDC) {
      try {
        const mockUSDC = await ethers.getContractAt(
          "MockUSDC",
          chainConfig.tokens.MockUSDC
        );
        const usdcBalance = await mockUSDC.balanceOf(signer.address);

        if (usdcBalance === 0n) {
          console.log(
            `💡 Get test tokens: npx hardhat run scripts/get-simple-vault-tokens.ts --network ${networkName}`
          );
        } else {
          console.log(
            `💡 Interact with vault: npx hardhat run scripts/interact-simple-vault.ts --network ${networkName}`
          );
        }
      } catch (error) {
        console.log(
          `💡 Get test tokens: npx hardhat run scripts/get-simple-vault-tokens.ts --network ${networkName}`
        );
      }
    }
  }

  console.log("\n📋 Available Commands:");
  console.log("======================");
  console.log(
    `• Deploy: npx hardhat run scripts/deploy-simple-vault.ts --network ${networkName}`
  );
  console.log(
    `• Get tokens: npx hardhat run scripts/get-simple-vault-tokens.ts --network ${networkName}`
  );
  console.log(
    `• Interact: npx hardhat run scripts/interact-simple-vault.ts --network ${networkName}`
  );
  console.log(
    `• Status: npx hardhat run scripts/simple-vault-status.ts --network ${networkName}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
