import { ethers } from "hardhat";
import { spawn } from "child_process";

interface PipelineConfig {
  ipAssetId: string;
  royaltyVaultAddress?: string;
  autoDepositProxyAddress: string;
  bridgeContract: string;
  minWIPAmount: string;
  deploymentPercentage?: number;
}

class RoyaltyOptimizationOrchestrator {
  private config: PipelineConfig;
  private storyProvider: ethers.JsonRpcProvider;
  private storySigner: ethers.Wallet;
  private userAddress: string;

  constructor(config: PipelineConfig) {
    this.config = config;
    this.storyProvider = new ethers.JsonRpcProvider("https://mainnet.storyrpc.io");
    const privateKey = process.env.PRIVATE_KEY || process.env.PRIV_KEY;
    this.storySigner = new ethers.Wallet(privateKey!, this.storyProvider);
    this.userAddress = this.storySigner.address;
  }

  async orchestrateFullPipeline(): Promise<void> {
    console.log("🎭 ROYALTY OPTIMIZATION ORCHESTRATOR");
    console.log("====================================");
    console.log(`👤 User: ${this.userAddress}`);
    console.log(`🎯 IP Asset: ${this.config.ipAssetId}`);
    console.log(`🔄 AutoDepositProxy: ${this.config.autoDepositProxyAddress}`);
    console.log("");

    // Check if user wants to start from a specific step
    const startStep = process.env.START_STEP || 'discovery';
    if (startStep !== 'discovery') {
      console.log(`⏩ Starting from step: ${startStep}`);
    }

    try {
      // Step 1: Try to discover RoyaltyVault using Story SDK (unless skipping)
      let royaltyVaultAddress: string | null = null;
      if (startStep === 'discovery') {
        royaltyVaultAddress = await this.stepDiscoverRoyaltyVaultSDK();
        
        if (royaltyVaultAddress) {
          // Full RoyaltyVault flow for properly set up IP Assets
          console.log("✅ Using RoyaltyVault-based claiming flow");
          
          // Step 2: Check RT Token ownership and transfer if needed
          await this.stepEnsureRoyaltyTokenOwnership(royaltyVaultAddress);
          
          // Step 3: Check RoyaltyVault for available WIP to claim
          const availableWIP = await this.stepCheckRoyaltyVaultBalance(royaltyVaultAddress);
          
          // Step 4: Claim WIP from RoyaltyVault only if there's WIP in the vault
          const vaultWIP = await this.getVaultWIPBalance(royaltyVaultAddress);
          if (vaultWIP > 0n) {
            await this.stepClaimFromRoyaltyVault(royaltyVaultAddress);
          } else {
            console.log("ℹ️ Skipping claim - no WIP in RoyaltyVault");
          }
        } else {
          // Direct claim fallback for test IP Assets
          console.log("⚠️ Using direct claim approach (no RoyaltyVault)");
          await this.stepDirectClaim();
        }
      }
      
      // Step 5: Check user token balance (WIP or native IP)
      if (startStep === 'discovery' || startStep === 'bridge') {
        const tokenInfo = await this.getWIPBalance();
        if (tokenInfo.balance < ethers.parseEther(this.config.minWIPAmount)) {
          const tokenType = tokenInfo.isNative ? 'IP' : 'WIP';
          console.log(`❌ Insufficient ${tokenType}: ${ethers.formatEther(tokenInfo.balance)} ${tokenType} (need ${this.config.minWIPAmount})`);
          return;
        }

        // Step 6: Auto-approve and bridge to AutoDepositProxy
        await this.stepBridgeToProxy(tokenInfo);
      }

      // Step 7: Start monitoring and auto-deposit system
      if (startStep === 'discovery' || startStep === 'bridge' || startStep === 'monitor') {
        await this.stepStartMonitoring();
      }

      // Step 8: Launch AI optimization
      await this.stepLaunchAIOptimization();

      console.log("\n🎉 ORCHESTRATION COMPLETE!");
      console.log("========================");
      console.log("✅ Full pipeline initiated successfully");
      console.log("🤖 System is now running autonomously");
      console.log("📈 Yield optimization will continue automatically");

    } catch (error) {
      console.error("❌ Pipeline orchestration failed:", error);
      throw error;
    }
  }

  private async stepDiscoverRoyaltyVaultSDK(): Promise<string | null> {
    console.log("📋 STEP 1: DISCOVERING ROYALTY VAULT");
    console.log("====================================");

    try {
      const { client } = await import("../utils");
      
      // Use Story SDK method (following the example you provided)
      const royaltyVaultAddress = await client.royalty.getRoyaltyVaultAddress(this.config.ipAssetId as any);
      
      if (!royaltyVaultAddress || royaltyVaultAddress === "0x0000000000000000000000000000000000000000") {
        console.log("⚠️ No RoyaltyVault found for this IP Asset");
        return null;
      }
      
      console.log(`🏦 RoyaltyVault Address: ${royaltyVaultAddress}`);
      
      // Verify it's actually a deployed contract
      const code = await ethers.provider.getCode(royaltyVaultAddress);
      if (code === "0x") {
        console.log("⚠️ RoyaltyVault address exists but no contract deployed");
        console.log("   This IP Asset needs proper license minting to deploy RoyaltyVault");
        return null;
      }
      
      // Quick check if it's ERC20 compatible
      try {
        const testContract = new ethers.Contract(royaltyVaultAddress, [
          "function totalSupply() view returns (uint256)"
        ], ethers.provider);
        await testContract.totalSupply();
        console.log("✅ RoyaltyVault is ERC20 compatible");
      } catch (e) {
        console.log("⚠️ RoyaltyVault exists but may not be properly initialized");
        return null;
      }
      
      return royaltyVaultAddress;
      
    } catch (error: any) {
      console.log(`⚠️ RoyaltyVault discovery failed: ${error.message}`);
      return null;
    }
  }

  private async stepDirectClaim(): Promise<void> {
    console.log("\n📋 DIRECT CLAIM APPROACH");
    console.log("========================");
    console.log("ℹ️ This IP Asset doesn't have a RoyaltyVault (likely a test asset)");
    console.log("🔄 Attempting direct claim using Story SDK...");

    try {
      const { client } = await import("../utils");
      
      const claimResult = await client.royalty.claimAllRevenue({
        ancestorIpId: this.config.ipAssetId as any,
        claimer: this.userAddress as any,
        childIpIds: [],
        royaltyPolicies: [],
        currencyTokens: ["0x1514000000000000000000000000000000000000"] // WIP
      });
      
      console.log(`✅ Direct claim transaction: ${claimResult.txHashes?.[0] || 'No txHash available'}`);
      
    } catch (claimError: any) {
      console.log(`⚠️ Direct claim result: ${claimError.message}`);
      console.log("   (This is normal if no new royalties are available)");
    }
  }

  private async stepDiscoverRoyaltyVault(): Promise<string> {
    console.log("📋 STEP 1: DISCOVERING ROYALTY VAULT");
    console.log("====================================");

    const ROYALTY_MODULE = "0xD2f60c40fEbccf6311f8B47c4f2Ec6b040400086";
    
    try {
      const royaltyModule = new ethers.Contract(ROYALTY_MODULE, [
        "function getRoyaltyVaultAddress(address ipId) external view returns (address)",
        "function royaltyVaults(address ipId) external view returns (address)",
        "function ipRoyaltyVaults(address ipId) external view returns (address)"
      ], ethers.provider);

      let royaltyVaultAddress;
      
      // Try multiple method signatures
      try {
        royaltyVaultAddress = await royaltyModule.getRoyaltyVaultAddress(this.config.ipAssetId);
        console.log("✅ Found RoyaltyVault using getRoyaltyVaultAddress");
      } catch (e) {
        try {
          royaltyVaultAddress = await royaltyModule.royaltyVaults(this.config.ipAssetId);
          console.log("✅ Found RoyaltyVault using royaltyVaults mapping");
        } catch (e2) {
          royaltyVaultAddress = await royaltyModule.ipRoyaltyVaults(this.config.ipAssetId);
          console.log("✅ Found RoyaltyVault using ipRoyaltyVaults mapping");
        }
      }
      
      console.log(`🏦 RoyaltyVault: ${royaltyVaultAddress}`);
      
      if (royaltyVaultAddress === "0x0000000000000000000000000000000000000000") {
        throw new Error("No RoyaltyVault found for this IP Asset");
      }
      
      return royaltyVaultAddress;
      
    } catch (error: any) {
      throw new Error(`Failed to discover RoyaltyVault: ${error.message}`);
    }
  }

  private async stepEnsureRoyaltyTokenOwnership(royaltyVaultAddress: string): Promise<void> {
    console.log("\n📋 STEP 2: CHECKING RT TOKEN OWNERSHIP");
    console.log("======================================");
    console.log("ℹ️ Royalty Tokens (RT) represent claim rights and are held at IP Asset Address");

    const rtContract = new ethers.Contract(royaltyVaultAddress, [
      "function balanceOf(address) view returns (uint256)",
      "function totalSupply() view returns (uint256)",
      "function transfer(address to, uint256 amount) external returns (bool)"
    ], ethers.provider);

    try {
      // Check RT token balances at correct locations
      const [userRTBalance, ipAssetRTBalance, totalSupply] = await Promise.all([
        rtContract.balanceOf(this.userAddress),        // User's RT tokens
        rtContract.balanceOf(this.config.ipAssetId),   // IP Asset's RT tokens (should be here!)
        rtContract.totalSupply().catch(() => 100000000n) // Default 100M if fails
      ]);

      console.log(`🎯 RT Tokens at IP Asset Address: ${ipAssetRTBalance.toString()}`);
      console.log(`👤 RT Tokens in User Wallet: ${userRTBalance.toString()}`);
      console.log(`📊 Total RT Supply: ${totalSupply.toString()}`);

      // Determine ownership situation
      const totalRTOwned = userRTBalance + ipAssetRTBalance;
      
      if (totalRTOwned === 0n) {
        console.log("❌ No RT tokens found - this IP Asset may not have claim rights");
        throw new Error("No Royalty Tokens found. Cannot claim from RoyaltyVault.");
      }

      // Check where RT tokens are located
      if (userRTBalance > 0n && ipAssetRTBalance > 0n) {
        // Tokens in both places
        const userPercent = (Number(userRTBalance) / Number(totalSupply) * 100).toFixed(2);
        const ipPercent = (Number(ipAssetRTBalance) / Number(totalSupply) * 100).toFixed(2);
        console.log(`✅ User already has ${userPercent}% RT tokens`);
        console.log(`ℹ️ Additional ${ipPercent}% RT tokens at IP Asset (can transfer if needed)`);
      } else if (userRTBalance > 0n) {
        // All tokens already in user wallet
        const ownershipPercent = (Number(userRTBalance) / Number(totalSupply) * 100).toFixed(2);
        console.log(`✅ User owns ${ownershipPercent}% of RT tokens - ready to claim WIP`);
      } else if (ipAssetRTBalance > 0n) {
        // All tokens still at IP Asset
        const ownershipPercent = (Number(ipAssetRTBalance) / Number(totalSupply) * 100).toFixed(2);
        console.log(`⚠️ ${ownershipPercent}% RT tokens at IP Asset - transferring to user...`);
        await this.transferRoyaltyTokensFromIPAsset(royaltyVaultAddress, ipAssetRTBalance);
      }
      
    } catch (error: any) {
      console.log(`⚠️ RT token check failed: ${error.message}`);
      console.log("🔄 This might be a test IP Asset without proper RoyaltyVault setup");
      throw error;
    }
  }

  private async transferRoyaltyTokensFromIPAsset(royaltyVaultAddress: string, availableTokens: bigint): Promise<void> {
    console.log("\n🔄 TRANSFERRING RT TOKENS FROM IP ASSET");
    console.log("======================================");

    try {
      const [signer] = await ethers.getSigners();
      const ipAccount = new ethers.Contract(this.config.ipAssetId, [
        "function execute(address to, uint256 value, bytes calldata data) external returns (bytes memory)",
        "function owner() external view returns (address)",
        "function isValidSigner(address signer) external view returns (bool)"
      ], signer);

      // Check permissions
      try {
        const isValidSigner = await ipAccount.isValidSigner(this.userAddress);
        if (!isValidSigner) {
          throw new Error("User not authorized to execute on IP Account");
        }
      } catch (permError) {
        console.log("⚠️ Could not verify permissions, attempting transfer anyway...");
      }

      // Transfer 50% or all available tokens
      const transferAmount = availableTokens > 50000000n ? 50000000n : availableTokens;
      
      const erc20 = new ethers.Contract(royaltyVaultAddress, [
        "function transfer(address to, uint256 amount) external returns (bool)"
      ], ethers.provider);

      const transferCalldata = erc20.interface.encodeFunctionData("transfer", [
        this.userAddress,
        transferAmount
      ]);

      console.log(`🔄 Transferring ${transferAmount.toString()} RT tokens to user wallet...`);

      const tx = await ipAccount.execute(
        royaltyVaultAddress,
        0,
        transferCalldata,
        { gasLimit: 500000 }
      );

      console.log(`📝 Transfer transaction: ${tx.hash}`);
      await tx.wait();
      console.log(`✅ RT tokens transferred successfully`);

    } catch (error: any) {
      throw new Error(`RT token transfer failed: ${error.message}. Manual transfer required via Story Protocol interface.`);
    }
  }

  private async stepCheckRoyaltyVaultBalance(royaltyVaultAddress: string): Promise<bigint> {
    console.log("\n📋 STEP 3: CHECKING WIP BALANCE");
    console.log("================================");
    console.log("ℹ️ Checking both RoyaltyVault and user wallet for WIP");

    const wipContract = new ethers.Contract("0x1514000000000000000000000000000000000000", [
      "function balanceOf(address) view returns (uint256)"
    ], this.storySigner);

    // Check both locations
    const [vaultWIP, userWIP] = await Promise.all([
      wipContract.balanceOf(royaltyVaultAddress),
      wipContract.balanceOf(this.userAddress)
    ]);

    console.log(`💰 WIP in RoyaltyVault: ${ethers.formatEther(vaultWIP)} WIP`);
    console.log(`💰 WIP in User Wallet: ${ethers.formatEther(userWIP)} WIP`);
    console.log(`📍 RoyaltyVault Address: ${royaltyVaultAddress}`);

    if (vaultWIP === 0n && userWIP === 0n) {
      console.log("❌ No WIP available anywhere");
      throw new Error("No WIP available to optimize");
    }

    if (vaultWIP === 0n && userWIP > 0n) {
      console.log("ℹ️ No new WIP in RoyaltyVault, but user already has WIP");
      console.log("🔄 Skipping claim step - proceeding with existing WIP");
      return userWIP;
    }

    if (vaultWIP > 0n) {
      console.log("✅ WIP available in RoyaltyVault for claiming!");
      return vaultWIP;
    }

    return vaultWIP;
  }

  private async stepClaimFromRoyaltyVault(royaltyVaultAddress: string): Promise<void> {
    console.log("\n📋 STEP 4: CLAIMING WIP FROM ROYALTY VAULT");
    console.log("==========================================");

    try {
      const { client } = await import("../utils");
      
      const claimResult = await client.royalty.claimAllRevenue({
        ancestorIpId: this.config.ipAssetId as any,
        claimer: this.userAddress as any,
        childIpIds: [],
        royaltyPolicies: [],
        currencyTokens: ["0x1514000000000000000000000000000000000000"] // WIP
      });
      
      console.log(`✅ Claim transaction: ${claimResult.txHashes?.[0] || 'No txHash available'}`);
      
    } catch (claimError: any) {
      throw new Error(`Claim failed: ${claimError.message}`);
    }
  }

  private async getWIPBalance(): Promise<{balance: bigint, isNative: boolean}> {
    // Add a small delay to ensure latest balance
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const wipContract = new ethers.Contract("0x1514000000000000000000000000000000000000", [
      "function balanceOf(address) view returns (uint256)"
    ], this.storySigner);

    const wipBalance = await wipContract.balanceOf(this.userAddress);
    const nativeBalance = await this.storyProvider.getBalance(this.userAddress);
    
    console.log(`💰 Available WIP: ${ethers.formatEther(wipBalance)} WIP`);
    console.log(`💰 Available Native IP: ${ethers.formatEther(nativeBalance)} IP`);
    
    // Prioritize native IP if available (means WIP was unwrapped during claiming)
    if (nativeBalance > wipBalance && nativeBalance > ethers.parseEther("0.1")) {
      console.log("ℹ️ Using native IP tokens - WIP was unwrapped during claiming");
      return { balance: nativeBalance, isNative: true };
    }
    
    return { balance: wipBalance, isNative: false };
  }

  private async getVaultWIPBalance(royaltyVaultAddress: string): Promise<bigint> {
    const wipContract = new ethers.Contract("0x1514000000000000000000000000000000000000", [
      "function balanceOf(address) view returns (uint256)"
    ], this.storySigner);

    return await wipContract.balanceOf(royaltyVaultAddress);
  }

  private async stepBridgeToProxy(tokenInfo: {balance: bigint, isNative: boolean}): Promise<void> {
    console.log("\n📋 STEP 2: BRIDGING TO PROXY");
    console.log("============================");

    const bridgeAmount = ethers.parseEther(this.config.minWIPAmount);
    const tokenType = tokenInfo.isNative ? 'IP' : 'WIP';
    const tokenAddress = tokenInfo.isNative ? "0x0000000000000000000000000000000000000000" : "0x1514000000000000000000000000000000000000";
    
    console.log(`💰 Bridging ${ethers.formatEther(bridgeAmount)} ${tokenType} to USDC`);

    // Handle approval for ERC20 WIP tokens (native IP doesn't need approval)
    if (!tokenInfo.isNative) {
      const wipContract = new ethers.Contract("0x1514000000000000000000000000000000000000", [
        "function approve(address,uint256) returns (bool)",
        "function allowance(address,address) view returns (uint256)"
      ], this.storySigner);

      const currentAllowance = await wipContract.allowance(this.userAddress, this.config.bridgeContract);
      
      if (currentAllowance < bridgeAmount) {
        console.log(`🔓 Auto-approving bridge for ${ethers.formatEther(bridgeAmount)} WIP...`);
        const approveTx = await wipContract.approve(this.config.bridgeContract, bridgeAmount);
        await approveTx.wait();
        console.log(`✅ Bridge approved`);
      } else {
        console.log(`✅ Bridge already approved`);
      }
    } else {
      console.log(`ℹ️ Native IP tokens don't require approval`);
    }

    // Get bridge quote and execute
    const queryParams = new URLSearchParams({
      srcChainId: "100000013", // Story Protocol
      srcChainTokenIn: tokenAddress, // WIP or native IP (0x0000...)
      srcChainTokenInAmount: bridgeAmount.toString(),
      dstChainId: "1", // Ethereum
      dstChainTokenOut: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
      dstChainTokenOutAmount: "auto",
      dstChainTokenOutRecipient: this.config.autoDepositProxyAddress,
      senderAddress: this.userAddress,
      srcChainOrderAuthorityAddress: this.userAddress,
      srcChainRefundAddress: this.userAddress,
      dstChainOrderAuthorityAddress: this.userAddress,
      referralCode: "31805",
      enableEstimate: "true",
      prependOperatingExpenses: "false"
    });

    const response = await fetch(`https://dln.debridge.finance/v1.0/dln/order/create-tx?${queryParams.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Bridge API Error: ${await response.text()}`);
    }

    const order = await response.json();
    const usdcExpected = Number(order.estimation.dstChainTokenOut.amount) / 1e6;

    console.log(`🌉 Bridge quote: ${ethers.formatEther(bridgeAmount)} ${tokenType} → ${usdcExpected} USDC`);

    // For native tokens, use the value from deBridge response (includes fees)
    const txValue = tokenInfo.isNative ? order.tx.value : (order.tx.value || 0);

    const bridgeTx = await this.storySigner.sendTransaction({
      to: order.tx.to,
      data: order.tx.data,
      value: txValue,
      gasLimit: 5000000
    });

    console.log(`📝 Bridge transaction: ${bridgeTx.hash}`);
    await bridgeTx.wait();
    console.log(`✅ Bridge confirmed - USDC will arrive at AutoDepositProxy`);
  }

  private async stepStartMonitoring(): Promise<void> {
    console.log("\n📋 STEP 3: STARTING MONITORING");
    console.log("==============================");

    return new Promise((resolve, reject) => {
      const monitorProcess = spawn('python3', [
        'Composable-AI-vaults-main-2/src/monitoring/auto_deposit_monitor.py',
        '--mode', 'monitor',
        '--interval', '15'
      ], {
        stdio: 'inherit',
        cwd: '/Users/danielyim/Downloads/AI-VAULTS-main',
        detached: true
      });

      monitorProcess.on('error', (error) => {
        console.error('❌ Monitor process error:', error);
        reject(error);
      });

      // Give it a moment to start
      setTimeout(() => {
        if (monitorProcess.pid) {
          console.log(`✅ Monitor launched! Process PID: ${monitorProcess.pid}`);
          console.log(`🔄 Monitoring AutoDepositProxy for USDC arrival...`);
          
          // Detach the process so it continues running
          monitorProcess.unref();
          resolve();
        } else {
          reject(new Error("Failed to start monitor process"));
        }
      }, 2000);
    });
  }

  private async stepLaunchAIOptimization(): Promise<void> {
    console.log("\n📋 STEP 4: AI OPTIMIZATION READY");
    console.log("=================================");
    
    console.log("🤖 AI optimization system is ready to deploy funds");
    console.log("📊 When USDC arrives and is deposited to vault:");
    console.log("   1. AI will analyze current DeFi yields");
    console.log("   2. Select optimal strategy (Aave vs Compound)");
    console.log("   3. Deploy funds for maximum yield");
    
    console.log("\n💡 To trigger manual optimization now:");
    console.log("   cd Composable-AI-vaults-main-2 && python3 src/main.py --mode once");
  }
}

// Pre-configured orchestration setups
const ORCHESTRATION_CONFIGS = {
  // Our tested IP Asset
  testIPAsset: {
    ipAssetId: "0x3F71cB2b66F255D361d17383909C20c29737340F",
    autoDepositProxyAddress: "0x4A2348aF9F254b5850C2B75AF30d58cDfA19b256",
    bridgeContract: "0x663DC15D3C1aC63ff12E45Ab68FeA3F0a883C251",
    minWIPAmount: "0.5"
  }
};

async function main() {
  // Get IP Asset ID from environment variable, command line, or use default
  const ipAssetId = process.env.IP_ASSET_ID || process.argv[2] || ORCHESTRATION_CONFIGS.testIPAsset.ipAssetId;
  
  console.log(`🎯 Orchestrating pipeline for IP Asset: ${ipAssetId}`);
  
  // Use existing config or create new one
  let config: PipelineConfig;
  if (ipAssetId === ORCHESTRATION_CONFIGS.testIPAsset.ipAssetId) {
    config = ORCHESTRATION_CONFIGS.testIPAsset;
  } else {
    // For new IP Assets, use the same infrastructure
    config = {
      ipAssetId,
      autoDepositProxyAddress: "0x4A2348aF9F254b5850C2B75AF30d58cDfA19b256",
      bridgeContract: "0x663DC15D3C1aC63ff12E45Ab68FeA3F0a883C251",
      minWIPAmount: "0.5"
    };
  }

  const orchestrator = new RoyaltyOptimizationOrchestrator(config);
  await orchestrator.orchestrateFullPipeline();
}

// Handle both direct execution and module export
if (require.main === module) {
  main()
    .then(() => {
      console.log("\n🎉 PIPELINE ORCHESTRATION INITIATED!");
      console.log("🤖 System is now autonomous - you can close this terminal");
      // Don't exit - keep monitoring running
    })
    .catch((error) => {
      console.error("❌ Orchestration failed:", error);
      process.exit(1);
    });
}

export { RoyaltyOptimizationOrchestrator, ORCHESTRATION_CONFIGS };