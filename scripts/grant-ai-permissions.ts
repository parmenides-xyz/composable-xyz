import { ethers } from "hardhat";

async function grantAIPermissions() {
  console.log("🤖 GRANTING AI AGENT PERMISSIONS");
  console.log("=================================");
  
  const provider = new ethers.JsonRpcProvider("https://eth-mainnet.g.alchemy.com/v2/exAp0m_LKHnmcM2Uni2BbYH5cLgBYaV2");
  const wallet = new ethers.Wallet(process.env.PRIV_KEY!, provider);
  
  const vaultAddress = "0x670d84987005083dE65C07672241f46dA678D24A";
  const aiAgentAddress = wallet.address; // AI agent uses same wallet
  
  // Role constants
  const MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"));
  const AGENT_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AGENT_ROLE"));
  
  const vault = new ethers.Contract(vaultAddress, [
    "function grantRole(bytes32 role, address account) external",
    "function hasRole(bytes32 role, address account) view returns (bool)"
  ], wallet);
  
  try {
    console.log(`🏦 Vault: ${vaultAddress}`);
    console.log(`🤖 AI Agent: ${aiAgentAddress}`);
    
    // Check current roles
    const hasManager = await vault.hasRole(MANAGER_ROLE, aiAgentAddress);
    const hasAgent = await vault.hasRole(AGENT_ROLE, aiAgentAddress);
    
    console.log(`\n📋 Current Permissions:`);
    console.log(`MANAGER_ROLE: ${hasManager}`);
    console.log(`AGENT_ROLE: ${hasAgent}`);
    
    if (!hasManager) {
      console.log(`\n🔓 Granting MANAGER_ROLE...`);
      const tx1 = await vault.grantRole(MANAGER_ROLE, aiAgentAddress);
      console.log(`📄 TX: ${tx1.hash}`);
      await tx1.wait();
      console.log(`✅ MANAGER_ROLE granted!`);
    }
    
    if (!hasAgent) {
      console.log(`\n🔓 Granting AGENT_ROLE...`);
      const tx2 = await vault.grantRole(AGENT_ROLE, aiAgentAddress);
      console.log(`📄 TX: ${tx2.hash}`);
      await tx2.wait();
      console.log(`✅ AGENT_ROLE granted!`);
    }
    
    // Verify roles are granted
    const newHasManager = await vault.hasRole(MANAGER_ROLE, aiAgentAddress);
    const newHasAgent = await vault.hasRole(AGENT_ROLE, aiAgentAddress);
    
    console.log(`\n✅ FINAL PERMISSIONS:`);
    console.log(`MANAGER_ROLE: ${newHasManager}`);
    console.log(`AGENT_ROLE: ${newHasAgent}`);
    
    if (newHasManager && newHasAgent) {
      console.log(`\n🎉 SUCCESS!`);
      console.log(`The AI agent now has full permissions to:`);
      console.log(`- Call deployFunds() to deploy idle USDC`);
      console.log(`- Call depositToStrategy() for specific deployments`);
      console.log(`- Rebalance between strategies`);
      console.log(`\n🚀 The AI agent can now run autonomously!`);
      console.log(`\n💡 Next steps:`);
      console.log(`1. Run the AI agent: python3 src/main.py`);
      console.log(`2. Watch it deploy the 14.22 USDC to strategies`);
      console.log(`3. Monitor yield generation!`);
    }
    
  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }
}

grantAIPermissions().catch(console.error);