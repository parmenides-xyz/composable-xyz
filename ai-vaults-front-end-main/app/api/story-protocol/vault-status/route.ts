import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

const VAULT_ADDRESS = '0x670d84987005083dE65C07672241f46dA678D24A';
const VAULT_ABI = [
  'function totalAssets() view returns (uint256)',
  'function decimals() view returns (uint8)'
];

export async function GET(request: NextRequest) {
  try {
    console.log('📊 Fetching real vault status from contract...');

    // Connect to Ethereum provider
    const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com');
    const vaultContract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, provider);

    // Get actual vault balance from contract
    const [totalAssets, decimals] = await Promise.all([
      vaultContract.totalAssets(),
      vaultContract.decimals()
    ]);

    // Convert to human readable format
    const totalOptimized = ethers.formatUnits(totalAssets, decimals);

    console.log(`Real vault balance: ${totalOptimized} USDC`);

    return NextResponse.json({
      success: true,
      optimization: {
        totalOptimized: parseFloat(totalOptimized).toFixed(2),
        currentAPY: 3.22, // Could fetch from Aave API for real rate
        bestStrategy: "Aave USDC",
        lastOptimization: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Failed to fetch vault status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vault status' },
      { status: 500 }
    );
  }
}

function parseVaultStatus(output: string) {
  const lines = output.split('\n');
  let totalOptimized = '16.03'; // Default from our successful deployment
  let currentAPY = 3.28; // Default Aave APY
  let bestStrategy = 'Aave USDC'; // Default strategy

  for (const line of lines) {
    // Extract vault balance information
    if (line.includes('Vault Balance:') || line.includes('total')) {
      const amountMatch = line.match(/([\d.]+) USDC/);
      if (amountMatch) {
        totalOptimized = amountMatch[1];
      }
    }

    // Extract deployed balance
    if (line.includes('Deployed:')) {
      const deployedMatch = line.match(/([\d.]+) USDC/);
      if (deployedMatch) {
        totalOptimized = deployedMatch[1];
      }
    }

    // Extract strategy information
    if (line.includes('Best available strategy:') || line.includes('aave')) {
      const strategyMatch = line.match(/Best available strategy: (\w+) with ([\d.]+)% APY/);
      if (strategyMatch) {
        bestStrategy = strategyMatch[1];
        currentAPY = parseFloat(strategyMatch[2]);
      } else if (line.toLowerCase().includes('aave')) {
        bestStrategy = 'Aave USDC';
        const apyMatch = line.match(/([\d.]+)%/);
        if (apyMatch) {
          currentAPY = parseFloat(apyMatch[1]);
        }
      }
    }
  }

  return {
    totalOptimized,
    currentAPY,
    bestStrategy,
    lastOptimization: new Date().toISOString(),
  };
}