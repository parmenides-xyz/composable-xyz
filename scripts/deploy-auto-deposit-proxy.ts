import { ethers } from "hardhat";

async function main() {
    console.log("🚀 Deploying AutoDepositProxy...");
    
    // Contract addresses
    const VAULT_ADDRESS = "0x670d84987005083dE65C07672241f46dA678D24A";
    const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    const BENEFICIARY = "0xd7220db831Ce0c7D33a4fD234208d245225D26d1"; // Our wallet
    
    console.log("📋 Deployment parameters:");
    console.log("  Vault:", VAULT_ADDRESS);
    console.log("  USDC:", USDC_ADDRESS);
    console.log("  Beneficiary:", BENEFICIARY);
    
    // Get deployer
    const [deployer] = await ethers.getSigners();
    console.log("  Deployer:", deployer.address);
    
    // Deploy AutoDepositProxy
    const AutoDepositProxy = await ethers.getContractFactory("AutoDepositProxy");
    const proxy = await AutoDepositProxy.deploy(
        VAULT_ADDRESS,
        USDC_ADDRESS,
        BENEFICIARY
    );
    
    await proxy.waitForDeployment();
    const proxyAddress = await proxy.getAddress();
    
    console.log("✅ AutoDepositProxy deployed to:", proxyAddress);
    
    // Verify deployment
    console.log("\n🔍 Verifying deployment...");
    const vault = await proxy.vault();
    const usdc = await proxy.usdc();
    const beneficiary = await proxy.beneficiary();
    
    console.log("  Vault address:", vault);
    console.log("  USDC address:", usdc);
    console.log("  Beneficiary:", beneficiary);
    
    // Test auto-deposit function (should do nothing with 0 balance)
    console.log("\n🧪 Testing autoDeposit function...");
    try {
        const tx = await proxy.autoDeposit();
        console.log("  autoDeposit() callable ✅");
    } catch (error) {
        console.log("  autoDeposit() error:", error);
    }
    
    console.log("\n🎉 Deployment complete!");
    console.log("📋 Summary:");
    console.log("  AutoDepositProxy:", proxyAddress);
    console.log("  Gas used: TBD (check tx)");
    console.log("\n💡 Next steps:");
    console.log("  1. Update orchestration to use this address");
    console.log("  2. Test bridge transfer to this contract");
    console.log("  3. Add monitoring to AI agent");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });