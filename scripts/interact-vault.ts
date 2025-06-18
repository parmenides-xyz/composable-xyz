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
  console.log(`🎮 Interacting with MultiTokenVault on ${networkName}`);
  console.log("=" + "=".repeat(35 + networkName.length));

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

  // Check if all contracts are deployed
  if (!chainConfig.vaults.MultiTokenVault) {
    console.log(`❌ MultiTokenVault not deployed on ${networkName}`);
    console.log(
      `💡 Run: npx hardhat run scripts/deploy-vault-system.ts --network ${networkName}`
    );
    return;
  }

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log(`\n👤 Account: ${deployer.address}`);

  // Get contract instances
  const vault = await ethers.getContractAt(
    "MultiTokenVault",
    chainConfig.vaults.MultiTokenVault
  );
  const usdc = await ethers.getContractAt(
    "MockUSDC",
    chainConfig.tokens.MockUSDC
  );
  const wbtc = await ethers.getContractAt(
    "MockWBTC",
    chainConfig.tokens.MockWBTC
  );
  const weth = await ethers.getContractAt(
    "MockWETH",
    chainConfig.tokens.MockWETH
  );

  console.log(`🏦 Vault: ${chainConfig.vaults.MultiTokenVault}`);
  console.log(`🔮 Pyth Oracle: ${chainConfig.pyth}\n`);

  // Show current balances
  console.log("💰 Current Balances:");
  console.log("===================");

  const usdcBalance = await usdc.balanceOf(deployer.address);
  const wbtcBalance = await wbtc.balanceOf(deployer.address);
  const wethBalance = await weth.balanceOf(deployer.address);
  const vaultShares = await vault.balanceOf(deployer.address);

  console.log(`  • USDC: ${ethers.formatUnits(usdcBalance, 6)}`);
  console.log(`  • WBTC: ${ethers.formatUnits(wbtcBalance, 8)}`);
  console.log(`  • WETH: ${ethers.formatUnits(wethBalance, 18)}`);
  console.log(`  • mtvUSDC: ${ethers.formatUnits(vaultShares, 6)}`);

  // Show vault status
  const totalAssets = await vault.totalAssets();
  const totalSupply = await vault.totalSupply();
  console.log(`\n🏦 Vault Status:`);
  console.log("================");
  console.log(`  • Total Assets: ${ethers.formatUnits(totalAssets, 6)} USDC`);
  console.log(
    `  • Total Shares: ${ethers.formatUnits(totalSupply, 6)} mtvUSDC`
  );
  console.log(
    `  • Exchange Rate: 1 mtvUSDC = ${
      totalSupply > 0
        ? ethers.formatUnits((totalAssets * 1000000n) / totalSupply, 6)
        : "1.0"
    } USDC`
  );

  // Test USDC deposit (this should always work)
  console.log(`\n🧪 Testing USDC Deposit:`);
  console.log("=========================");

  const depositAmount = ethers.parseUnits("1000", 6); // 1000 USDC

  if (usdcBalance >= depositAmount) {
    try {
      console.log(
        `   Depositing ${ethers.formatUnits(depositAmount, 6)} USDC...`
      );

      // Check if approval is needed
      const currentAllowance = await usdc.allowance(
        deployer.address,
        chainConfig.vaults.MultiTokenVault
      );
      if (currentAllowance < depositAmount) {
        console.log(`   Approving USDC...`);
        const approveTx = await usdc.approve(
          chainConfig.vaults.MultiTokenVault,
          depositAmount
        );
        await approveTx.wait();
      }

      // Deposit USDC
      const depositTx = await vault.deposit(depositAmount, deployer.address);
      await depositTx.wait();

      // Check new balances
      const newUsdcBalance = await usdc.balanceOf(deployer.address);
      const newVaultShares = await vault.balanceOf(deployer.address);

      console.log(`   ✅ Success!`);
      console.log(
        `   • USDC balance: ${ethers.formatUnits(
          usdcBalance,
          6
        )} → ${ethers.formatUnits(newUsdcBalance, 6)}`
      );
      console.log(
        `   • Vault shares: ${ethers.formatUnits(
          vaultShares,
          6
        )} → ${ethers.formatUnits(newVaultShares, 6)}`
      );
    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}`);
    }
  } else {
    console.log(
      `   ⚠️  Insufficient USDC balance (need ${ethers.formatUnits(
        depositAmount,
        6
      )}, have ${ethers.formatUnits(usdcBalance, 6)})`
    );
    console.log(
      `   💡 Run: npx hardhat run scripts/get-test-tokens.ts --network ${networkName}`
    );
  }

  // Test WBTC deposit (may fail due to stale oracle data)
  console.log(`\n🧪 Testing WBTC Deposit:`);
  console.log("=========================");

  const wbtcDepositAmount = ethers.parseUnits("0.01", 8); // 0.01 WBTC

  if (wbtcBalance >= wbtcDepositAmount) {
    try {
      // First test preview
      console.log(
        `   Testing oracle for ${ethers.formatUnits(
          wbtcDepositAmount,
          8
        )} WBTC...`
      );
      const previewValue = await vault.previewTokenDeposit(
        chainConfig.tokens.MockWBTC,
        wbtcDepositAmount
      );
      console.log(
        `   Oracle price: ${ethers.formatUnits(
          wbtcDepositAmount,
          8
        )} WBTC = ${ethers.formatUnits(previewValue, 6)} USDC`
      );

      // Approve WBTC if needed
      const currentWbtcAllowance = await wbtc.allowance(
        deployer.address,
        chainConfig.vaults.MultiTokenVault
      );
      if (currentWbtcAllowance < wbtcDepositAmount) {
        console.log(`   Approving WBTC...`);
        const approveTx = await wbtc.approve(
          chainConfig.vaults.MultiTokenVault,
          wbtcDepositAmount
        );
        await approveTx.wait();
      }

      // Deposit WBTC
      console.log(
        `   Depositing ${ethers.formatUnits(wbtcDepositAmount, 8)} WBTC...`
      );
      const depositTx = await vault.depositToken(
        chainConfig.tokens.MockWBTC,
        wbtcDepositAmount,
        deployer.address
      );
      await depositTx.wait();

      // Check new balances
      const newWbtcBalance = await wbtc.balanceOf(deployer.address);
      const newVaultShares = await vault.balanceOf(deployer.address);

      console.log(`   ✅ Success!`);
      console.log(
        `   • WBTC balance: ${ethers.formatUnits(
          wbtcBalance,
          8
        )} → ${ethers.formatUnits(newWbtcBalance, 8)}`
      );
      console.log(
        `   • Vault shares increased by: ${ethers.formatUnits(
          newVaultShares - vaultShares,
          6
        )} mtvUSDC`
      );
    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}`);
      if (
        error.message.includes("PriceStale") ||
        error.message.includes("execution reverted")
      ) {
        console.log(
          `   💡 This is likely due to stale price data on ${networkName}`
        );
        console.log(
          `   💡 Pyth oracles may not be actively updated on testnets`
        );
      }
    }
  } else {
    console.log(
      `   ⚠️  Insufficient WBTC balance (need ${ethers.formatUnits(
        wbtcDepositAmount,
        8
      )}, have ${ethers.formatUnits(wbtcBalance, 8)})`
    );
    console.log(
      `   💡 Run: npx hardhat run scripts/get-test-tokens.ts --network ${networkName}`
    );
  }

  // Test WETH deposit (may fail due to stale oracle data)
  console.log(`\n🧪 Testing WETH Deposit:`);
  console.log("=========================");

  const wethDepositAmount = ethers.parseUnits("0.1", 18); // 0.1 WETH

  if (wethBalance >= wethDepositAmount) {
    try {
      // First test preview
      console.log(
        `   Testing oracle for ${ethers.formatUnits(
          wethDepositAmount,
          18
        )} WETH...`
      );
      const previewValue = await vault.previewTokenDeposit(
        chainConfig.tokens.MockWETH,
        wethDepositAmount
      );
      console.log(
        `   Oracle price: ${ethers.formatUnits(
          wethDepositAmount,
          18
        )} WETH = ${ethers.formatUnits(previewValue, 6)} USDC`
      );

      // Approve WETH if needed
      const currentWethAllowance = await weth.allowance(
        deployer.address,
        chainConfig.vaults.MultiTokenVault
      );
      if (currentWethAllowance < wethDepositAmount) {
        console.log(`   Approving WETH...`);
        const approveTx = await weth.approve(
          chainConfig.vaults.MultiTokenVault,
          wethDepositAmount
        );
        await approveTx.wait();
      }

      // Deposit WETH
      console.log(
        `   Depositing ${ethers.formatUnits(wethDepositAmount, 18)} WETH...`
      );
      const depositTx = await vault.depositToken(
        chainConfig.tokens.MockWETH,
        wethDepositAmount,
        deployer.address
      );
      await depositTx.wait();

      // Check new balances
      const newWethBalance = await weth.balanceOf(deployer.address);
      const newVaultShares = await vault.balanceOf(deployer.address);

      console.log(`   ✅ Success!`);
      console.log(
        `   • WETH balance: ${ethers.formatUnits(
          wethBalance,
          18
        )} → ${ethers.formatUnits(newWethBalance, 18)}`
      );
      console.log(
        `   • Vault shares increased by: ${ethers.formatUnits(
          newVaultShares - vaultShares,
          6
        )} mtvUSDC`
      );
    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}`);
      if (
        error.message.includes("PriceStale") ||
        error.message.includes("execution reverted")
      ) {
        console.log(
          `   💡 This is likely due to stale price data on ${networkName}`
        );
        console.log(
          `   💡 Pyth oracles may not be actively updated on testnets`
        );
      }
    }
  } else {
    console.log(
      `   ⚠️  Insufficient WETH balance (need ${ethers.formatUnits(
        wethDepositAmount,
        18
      )}, have ${ethers.formatUnits(wethBalance, 18)})`
    );
    console.log(
      `   💡 Run: npx hardhat run scripts/get-test-tokens.ts --network ${networkName}`
    );
  }

  // Final status
  console.log(`\n📊 Final Status:`);
  console.log("================");

  const finalUsdcBalance = await usdc.balanceOf(deployer.address);
  const finalWbtcBalance = await wbtc.balanceOf(deployer.address);
  const finalWethBalance = await weth.balanceOf(deployer.address);
  const finalVaultShares = await vault.balanceOf(deployer.address);
  const finalTotalAssets = await vault.totalAssets();
  const finalTotalSupply = await vault.totalSupply();

  console.log(`  • Your USDC: ${ethers.formatUnits(finalUsdcBalance, 6)}`);
  console.log(`  • Your WBTC: ${ethers.formatUnits(finalWbtcBalance, 8)}`);
  console.log(`  • Your WETH: ${ethers.formatUnits(finalWethBalance, 18)}`);
  console.log(`  • Your mtvUSDC: ${ethers.formatUnits(finalVaultShares, 6)}`);
  console.log(
    `  • Vault Total Assets: ${ethers.formatUnits(finalTotalAssets, 6)} USDC`
  );
  console.log(
    `  • Vault Total Shares: ${ethers.formatUnits(finalTotalSupply, 6)} mtvUSDC`
  );

  console.log(`\n🎯 Next Steps:`);
  console.log("==============");
  console.log(
    `1. Get more tokens: npx hardhat run scripts/get-test-tokens.ts --network ${networkName}`
  );
  console.log(
    `2. Check vault status: npx hardhat run scripts/vault-status.ts --network ${networkName}`
  );
  console.log(
    `3. Try withdrawals: Implement withdraw functionality in this script`
  );
  console.log(
    `4. Deploy on another network: npx hardhat run scripts/deploy-vault-system.ts --network <network>`
  );

  console.log(`\n✨ Interaction completed!`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Interaction failed:", error);
    process.exit(1);
  });
