import { ethers } from "hardhat";

async function verifyVaultContract() {
  console.log("🔍 VERIFYING VAULT CONTRACT");
  console.log("===========================");
  
  const provider = new ethers.JsonRpcProvider("https://eth-mainnet.g.alchemy.com/v2/exAp0m_LKHnmcM2Uni2BbYH5cLgBYaV2");
  const vaultAddress = "0x670d84987005083dE65C07672241f46dA678D24A";
  
  try {
    // Check if address has code
    const code = await provider.getCode(vaultAddress);
    console.log(`📍 Address: ${vaultAddress}`);
    console.log(`📄 Has code: ${code !== '0x' ? 'YES ✅' : 'NO ❌'}`);
    console.log(`📏 Code size: ${(code.length - 2) / 2} bytes`);
    
    if (code === '0x') {
      console.log("❌ This is not a contract address!");
      return;
    }
    
    // Try basic ERC4626 vault interface
    const vault = new ethers.Contract(vaultAddress, [
      "function name() view returns (string)",
      "function symbol() view returns (string)",
      "function decimals() view returns (uint8)",
      "function totalAssets() view returns (uint256)",
      "function totalSupply() view returns (uint256)",
      "function asset() view returns (address)"
    ], provider);
    
    // Try to call basic functions
    console.log("\n📊 TRYING BASIC CALLS:");
    
    try {
      const name = await vault.name();
      console.log(`✅ Name: ${name}`);
    } catch (e) {
      console.log("❌ name() failed");
    }
    
    try {
      const symbol = await vault.symbol();
      console.log(`✅ Symbol: ${symbol}`);
    } catch (e) {
      console.log("❌ symbol() failed");
    }
    
    try {
      const decimals = await vault.decimals();
      console.log(`✅ Decimals: ${decimals}`);
    } catch (e) {
      console.log("❌ decimals() failed");
    }
    
    try {
      const totalSupply = await vault.totalSupply();
      console.log(`✅ Total Supply: ${ethers.formatUnits(totalSupply, 6)}`);
    } catch (e) {
      console.log("❌ totalSupply() failed");
    }
    
    try {
      const totalAssets = await vault.totalAssets();
      console.log(`✅ Total Assets: ${ethers.formatUnits(totalAssets, 6)}`);
    } catch (e) {
      console.log("❌ totalAssets() failed");
    }
    
    try {
      const asset = await vault.asset();
      console.log(`✅ Asset: ${asset}`);
    } catch (e) {
      console.log("❌ asset() failed");
    }
    
  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }
}

verifyVaultContract().catch(console.error);