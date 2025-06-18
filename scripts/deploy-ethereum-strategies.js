const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Deploying Ethereum Strategy Contracts...");
    
    // Get deployer
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    
    // Contract addresses
    const USDC = "0xA0B86a33E6441AdDE4B0C62F2b48dF92CAf9e6b7"; // Ethereum USDC
    const DEBRIDGE_GATE = "0x43dE2d77BF8027e25dBD179B491e8d64f38398aA"; // deBridge Gate on Ethereum
    
    console.log("\n📋 Configuration:");
    console.log("USDC:", USDC);
    console.log("deBridge Gate:", DEBRIDGE_GATE);
    
    // Deploy Vault first (needed for strategies)
    console.log("\n1️⃣ Deploying Vault...");
    const Vault = await ethers.getContractFactory("Vault");
    const vault = await Vault.deploy(
        USDC,                    // underlying asset
        "Story Yield Vault",     // name
        "syvUSDC",              // symbol
        deployer.address,        // manager
        deployer.address,        // agent
        DEBRIDGE_GATE           // deBridge gate
    );
    await vault.waitForDeployment();
    console.log("✅ Vault deployed to:", await vault.getAddress());
    
    // Deploy AaveV3Strategy
    console.log("\n2️⃣ Deploying AaveV3Strategy...");
    const AaveV3Strategy = await ethers.getContractFactory("AaveV3Strategy");
    const aaveStrategy = await AaveV3Strategy.deploy(await vault.getAddress());
    await aaveStrategy.waitForDeployment();
    console.log("✅ AaveV3Strategy deployed to:", await aaveStrategy.getAddress());
    
    // Deploy CompoundV3Strategy
    console.log("\n3️⃣ Deploying CompoundV3Strategy...");
    const CompoundV3Strategy = await ethers.getContractFactory("CompoundV3Strategy");
    const compoundStrategy = await CompoundV3Strategy.deploy(await vault.getAddress());
    await compoundStrategy.waitForDeployment();
    console.log("✅ CompoundV3Strategy deployed to:", await compoundStrategy.getAddress());
    
    // Deploy CrossChainVaultReceiver
    console.log("\n4️⃣ Deploying CrossChainVaultReceiver...");
    const CrossChainVaultReceiver = await ethers.getContractFactory("CrossChainVaultReceiver");
    const receiver = await CrossChainVaultReceiver.deploy(
        await vault.getAddress(),           // vault
        deployer.address,        // bridge operator
        deployer.address         // executor
    );
    await receiver.waitForDeployment();
    console.log("✅ CrossChainVaultReceiver deployed to:", await receiver.getAddress());
    
    // Configure the system
    console.log("\n⚙️ Configuring system...");
    
    // Add strategies to vault
    console.log("Adding strategies to vault...");
    await vault.addStrategy(await aaveStrategy.getAddress());
    await vault.addStrategy(await compoundStrategy.getAddress());
    console.log("✅ Strategies added to vault");
    
    // Add Ethereum as supported chain (chain ID 1)
    console.log("Configuring cross-chain support...");
    await vault.addSupportedChain(1, await vault.getAddress()); // Self-reference for Ethereum
    console.log("✅ Cross-chain configuration complete");
    
    // Configure receiver
    console.log("Configuring receiver...");
    await receiver.addSupportedToken(USDC);
    await receiver.addStrategy(USDC, await aaveStrategy.getAddress(), 5000); // 50% weight
    await receiver.addStrategy(USDC, await compoundStrategy.getAddress(), 5000); // 50% weight
    console.log("✅ Receiver configuration complete");
    
    // Grant receiver bridge role on vault
    const BRIDGE_ROLE = await vault.BRIDGE_ROLE();
    await vault.grantRole(BRIDGE_ROLE, await receiver.getAddress());
    console.log("✅ Bridge role granted to receiver");
    
    console.log("\n🎉 Deployment Complete!");
    console.log("\n📊 Contract Addresses:");
    console.log("Vault:", await vault.getAddress());
    console.log("AaveV3Strategy:", await aaveStrategy.getAddress());
    console.log("CompoundV3Strategy:", await compoundStrategy.getAddress());
    console.log("CrossChainVaultReceiver:", await receiver.getAddress());
    
    console.log("\n🔗 Next Steps:");
    console.log("1. Update Story Protocol contracts with Ethereum vault address");
    console.log("2. Configure deBridge for cross-chain deployment");
    console.log("3. Test with small amounts first");
    console.log("4. Update AI system with new contract addresses");
    
    // Verify contracts on Etherscan
    console.log("\n📝 Verifying contracts...");
    if (network.name !== "hardhat" && network.name !== "localhost") {
        console.log("Waiting for block confirmations...");
        await vault.deploymentTransaction().wait(5);
        
        try {
            await hre.run("verify:verify", {
                address: await vault.getAddress(),
                constructorArguments: [
                    USDC,
                    "Story Yield Vault",
                    "syvUSDC",
                    deployer.address,
                    deployer.address,
                    DEBRIDGE_GATE
                ]
            });
            console.log("✅ Vault verified");
        } catch (e) {
            console.log("❌ Vault verification failed:", e.message);
        }
        
        try {
            await hre.run("verify:verify", {
                address: await aaveStrategy.getAddress(),
                constructorArguments: [await vault.getAddress()]
            });
            console.log("✅ AaveV3Strategy verified");
        } catch (e) {
            console.log("❌ AaveV3Strategy verification failed:", e.message);
        }
        
        try {
            await hre.run("verify:verify", {
                address: await compoundStrategy.getAddress(),
                constructorArguments: [await vault.getAddress()]
            });
            console.log("✅ CompoundV3Strategy verified");
        } catch (e) {
            console.log("❌ CompoundV3Strategy verification failed:", e.message);
        }
        
        try {
            await hre.run("verify:verify", {
                address: await receiver.getAddress(),
                constructorArguments: [
                    await vault.getAddress(),
                    deployer.address,
                    deployer.address
                ]
            });
            console.log("✅ CrossChainVaultReceiver verified");
        } catch (e) {
            console.log("❌ CrossChainVaultReceiver verification failed:", e.message);
        }
    }
    
    console.log("\n🚀 Ready for cross-chain royalty yield optimization!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
