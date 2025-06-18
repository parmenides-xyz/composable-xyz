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
  console.log(`🎮 Simple Vault Interaction on ${networkName}`);
  console.log("=========================================");

  // Load deployment data
  const deploymentData = loadDeployments();
  const chainConfig = deploymentData.chains[networkName];

  if (!chainConfig) {
    throw new Error(
      `Network ${networkName} not configured in deployments.json. Please deploy first.`
    );
  }

  if (!chainConfig.tokens.MockUSDC || !chainConfig.vaults.Vault) {
    throw new Error(
      `Contracts not deployed on ${networkName}. Please deploy first.`
    );
  }

  // Get signer
  const [signer] = await ethers.getSigners();
  console.log(`👤 Account: ${signer.address}`);
  console.log(
    `💰 Native Balance: ${ethers.formatEther(
      await signer.provider.getBalance(signer.address)
    )} ${networkName.includes("rootstock") ? "RBTC" : "ETH"}\n`
  );

  // Get contracts
  const mockUSDC = await ethers.getContractAt(
    "MockUSDC",
    chainConfig.tokens.MockUSDC
  );
  const vault = await ethers.getContractAt("Vault", chainConfig.vaults.Vault);

  // Display current state
  await displayCurrentState(mockUSDC, vault, signer.address);

  // Get action from command line arguments
  const action = process.argv[2] || "demo";

  switch (action.toLowerCase()) {
    case "deposit":
      await depositToVault(mockUSDC, vault, signer);
      break;
    case "withdraw":
      await withdrawFromVault(vault, signer);
      break;
    case "redeem":
      await redeemFromVault(vault, signer);
      break;
    case "demo":
      await runDemo(mockUSDC, vault, signer);
      break;
    case "status":
      // Already displayed above
      break;
    default:
      displayUsage();
      return;
  }

  // Display final state
  console.log("\n" + "=".repeat(50));
  await displayCurrentState(mockUSDC, vault, signer.address);
}

async function displayCurrentState(
  mockUSDC: any,
  vault: any,
  userAddress: string
) {
  console.log("📊 Current State:");
  console.log("================");

  try {
    // Token balances
    const usdcBalance = await mockUSDC.balanceOf(userAddress);
    const vaultShares = await vault.balanceOf(userAddress);

    // Vault state
    const totalAssets = await vault.totalAssets();
    const totalSupply = await vault.totalSupply();
    const vaultSymbol = await vault.symbol();

    console.log(`💰 Your Balances:`);
    console.log(`  • USDC: ${ethers.formatUnits(usdcBalance, 6)}`);
    console.log(`  • ${vaultSymbol}: ${ethers.formatUnits(vaultShares, 18)}`);

    console.log(`🏦 Vault State:`);
    console.log(`  • Total Assets: ${ethers.formatUnits(totalAssets, 6)} USDC`);
    console.log(
      `  • Total Supply: ${ethers.formatUnits(totalSupply, 18)} ${vaultSymbol}`
    );

    // Calculate share value if there are shares
    if (totalSupply > 0n) {
      const shareValue =
        (totalAssets * ethers.parseUnits("1", 18)) / totalSupply;
      console.log(
        `  • Share Value: ${ethers.formatUnits(
          shareValue,
          6
        )} USDC per ${vaultSymbol}`
      );
    }

    // Your vault value
    if (vaultShares > 0n) {
      const yourAssets = await vault.previewRedeem(vaultShares);
      console.log(
        `  • Your Vault Value: ${ethers.formatUnits(yourAssets, 6)} USDC`
      );
    }
  } catch (error: any) {
    console.log(`❌ Error fetching state: ${error.message}`);
  }

  console.log("");
}

async function depositToVault(mockUSDC: any, vault: any, signer: any) {
  const amount = ethers.parseUnits("1000", 6); // 1,000 USDC

  console.log(
    `💰 Depositing ${ethers.formatUnits(amount, 6)} USDC to vault...`
  );

  try {
    // Check balance
    const balance = await mockUSDC.balanceOf(signer.address);
    if (balance < amount) {
      console.log(
        `❌ Insufficient USDC balance. You have ${ethers.formatUnits(
          balance,
          6
        )} USDC`
      );
      return;
    }

    // Approve vault to spend USDC
    console.log("   Approving USDC...");
    const approveTx = await mockUSDC.approve(await vault.getAddress(), amount);
    await approveTx.wait();
    console.log("   ✅ Approval confirmed");

    // Deposit to vault
    console.log("   Depositing to vault...");
    const depositTx = await vault.deposit(amount, signer.address);
    console.log(`   Transaction hash: ${depositTx.hash}`);
    await depositTx.wait();
    console.log("   ✅ Deposit confirmed");

    // Get shares received
    const receipt = await depositTx.wait();
    console.log(`   ✅ Deposit successful!`);
  } catch (error: any) {
    console.log(`❌ Deposit failed: ${error.message}`);
  }
}

async function withdrawFromVault(vault: any, signer: any) {
  const amount = ethers.parseUnits("500", 6); // 500 USDC

  console.log(
    `💸 Withdrawing ${ethers.formatUnits(amount, 6)} USDC from vault...`
  );

  try {
    // Check if we can withdraw this amount
    const maxWithdraw = await vault.maxWithdraw(signer.address);
    if (maxWithdraw < amount) {
      console.log(
        `❌ Cannot withdraw ${ethers.formatUnits(
          amount,
          6
        )} USDC. Max withdrawable: ${ethers.formatUnits(maxWithdraw, 6)} USDC`
      );
      return;
    }

    // Withdraw from vault
    const withdrawTx = await vault.withdraw(
      amount,
      signer.address,
      signer.address
    );
    console.log(`   Transaction hash: ${withdrawTx.hash}`);
    await withdrawTx.wait();
    console.log("   ✅ Withdrawal successful!");
  } catch (error: any) {
    console.log(`❌ Withdrawal failed: ${error.message}`);
  }
}

async function redeemFromVault(vault: any, signer: any) {
  const shares = ethers.parseUnits("100", 18); // 100 shares

  console.log(`🔄 Redeeming ${ethers.formatUnits(shares, 18)} vault shares...`);

  try {
    // Check if we have enough shares
    const balance = await vault.balanceOf(signer.address);
    if (balance < shares) {
      console.log(
        `❌ Insufficient shares. You have ${ethers.formatUnits(
          balance,
          18
        )} shares`
      );
      return;
    }

    // Preview redemption
    const assets = await vault.previewRedeem(shares);
    console.log(`   Will receive: ${ethers.formatUnits(assets, 6)} USDC`);

    // Redeem shares
    const redeemTx = await vault.redeem(shares, signer.address, signer.address);
    console.log(`   Transaction hash: ${redeemTx.hash}`);
    await redeemTx.wait();
    console.log("   ✅ Redemption successful!");
  } catch (error: any) {
    console.log(`❌ Redemption failed: ${error.message}`);
  }
}

async function runDemo(mockUSDC: any, vault: any, signer: any) {
  console.log("🎬 Running Demo Sequence...");
  console.log("===========================");

  // Check if we have USDC
  const usdcBalance = await mockUSDC.balanceOf(signer.address);
  if (usdcBalance < ethers.parseUnits("1000", 6)) {
    console.log("❌ Need at least 1,000 USDC for demo. Get tokens first:");
    console.log(
      `   npx hardhat run scripts/get-simple-vault-tokens.ts --network ${network.name}`
    );
    return;
  }

  console.log("\n1️⃣ Depositing 1,000 USDC...");
  await depositToVault(mockUSDC, vault, signer);

  console.log("\n2️⃣ Waiting a moment...");
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log("\n3️⃣ Withdrawing 300 USDC...");
  const withdrawAmount = ethers.parseUnits("300", 6);
  try {
    const withdrawTx = await vault.withdraw(
      withdrawAmount,
      signer.address,
      signer.address
    );
    await withdrawTx.wait();
    console.log("   ✅ Withdrawal successful!");
  } catch (error: any) {
    console.log(`   ❌ Withdrawal failed: ${error.message}`);
  }

  console.log("\n🎉 Demo completed!");
}

function displayUsage() {
  console.log("🔧 Usage:");
  console.log(
    `npx hardhat run scripts/interact-simple-vault.ts --network ${network.name} -- <action>`
  );
  console.log("");
  console.log("Available actions:");
  console.log("  status    - Show current vault state (default)");
  console.log("  deposit   - Deposit 1,000 USDC to vault");
  console.log("  withdraw  - Withdraw 500 USDC from vault");
  console.log("  redeem    - Redeem 100 vault shares");
  console.log("  demo      - Run a complete demo sequence");
  console.log("");
  console.log("Examples:");
  console.log(
    `  npx hardhat run scripts/interact-simple-vault.ts --network ${network.name} -- status`
  );
  console.log(
    `  npx hardhat run scripts/interact-simple-vault.ts --network ${network.name} -- deposit`
  );
  console.log(
    `  npx hardhat run scripts/interact-simple-vault.ts --network ${network.name} -- demo`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
