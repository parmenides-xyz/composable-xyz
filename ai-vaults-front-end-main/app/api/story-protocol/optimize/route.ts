import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

interface OptimizeRequest {
  ipAssetId: string;
  userAddress: string;
}

export async function POST(request: NextRequest) {
  try {
    const { ipAssetId, userAddress }: OptimizeRequest = await request.json();

    if (!ipAssetId || !userAddress) {
      return NextResponse.json(
        { error: 'Missing ipAssetId or userAddress' },
        { status: 400 }
      );
    }

    // Validate IP Asset ID format
    if (!/^0x[a-fA-F0-9]{40}$/.test(ipAssetId)) {
      return NextResponse.json(
        { error: 'Invalid IP Asset ID format' },
        { status: 400 }
      );
    }

    // Execute the real orchestration script
    const scriptPath = path.join(process.cwd(), '..', 'scripts', 'debridge-pipeline.ts');
    
    return new Promise((resolve) => {
      const child = spawn('npx', ['hardhat', 'run', scriptPath, '--network', 'ethereum'], {
        cwd: path.join(process.cwd(), '..'),
        env: {
          ...process.env,
          IP_ASSET_ID: ipAssetId,
          USER_ADDRESS: userAddress,
        },
      });

      let output = '';
      let error = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
        console.log('Orchestration output:', data.toString());
      });

      child.stderr.on('data', (data) => {
        error += data.toString();
        console.error('Orchestration error:', data.toString());
      });

      child.on('close', (code) => {
        console.log('Orchestration completed with code:', code);
        console.log('Output:', output);
        console.log('Error:', error);
        
        if (code === 0) {
          const result = parseOrchestrationOutput(output);
          resolve(NextResponse.json(result));
        } else {
          console.error('Orchestration failed with code:', code);
          resolve(NextResponse.json(
            { 
              error: 'Orchestration failed', 
              details: error,
              output: output,
              code: code
            },
            { status: 500 }
          ));
        }
      });

      setTimeout(() => {
        child.kill();
        resolve(NextResponse.json(
          { error: 'Operation timed out' },
          { status: 408 }
        ));
      }, 300000); // 5 minutes timeout
    });


  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function parseOrchestrationOutput(output: string) {
  const lines = output.split('\n');
  const steps = [];
  let totalOptimized = '0';
  let currentAPY = 0;
  let bestStrategy = 'Unknown';
  let txHashes = [];

  for (const line of lines) {
    // Extract transaction hashes
    if (line.includes('transaction:') || line.includes('txHash:') || line.match(/0x[a-fA-F0-9]{40,64}/)) {
      const hashMatch = line.match(/0x[a-fA-F0-9]{40,64}/);
      if (hashMatch && hashMatch[0].length >= 40) {
        txHashes.push(hashMatch[0]);
      }
    }

    // Extract step starts and completions
    if (line.includes('STEP') || line.includes('📋')) {
      const step = {
        id: extractStepId(line),
        name: extractStepName(line),
        status: 'completed' as const,
        timestamp: new Date().toISOString(),
        description: extractStepDescription(line),
        txHash: txHashes[txHashes.length - 1],
      };
      steps.push(step);
    }

    // Handle specific completion markers
    if (line.includes('🏦 RoyaltyVault Address:')) {
      const vaultStep = {
        id: 'discovery',
        name: 'RoyaltyVault Discovery',
        status: 'completed' as const,
        timestamp: new Date().toISOString(),
        description: 'Located RoyaltyVault for IP Asset',
        txHash: line.match(/0x[a-fA-F0-9]{40}/)?.[0],
      };
      if (!steps.find(s => s.id === 'discovery')) {
        steps.push(vaultStep);
      }
    }

    // Check for wallet WIP balance (means balance check completed)
    if (line.includes('💰 WIP in User Wallet:') || line.includes('Available WIP:')) {
      const balanceStep = {
        id: 'balance',
        name: 'Balance Check',
        status: 'completed' as const,
        timestamp: new Date().toISOString(),
        description: 'Found WIP balance in user wallet',
      };
      if (!steps.find(s => s.id === 'balance')) {
        steps.push(balanceStep);
      }
    }

    // Extract optimization results
    if (line.includes('Total optimized:') || line.includes('USDC')) {
      const amountMatch = line.match(/(\d+\.?\d*)/);
      if (amountMatch) {
        totalOptimized = amountMatch[1];
      }
    }

    if (line.includes('APY:') || line.includes('yield:')) {
      const apyMatch = line.match(/(\d+\.?\d*)%/);
      if (apyMatch) {
        currentAPY = parseFloat(apyMatch[1]);
      }
    }

    if (line.includes('strategy:') || line.includes('Selected:')) {
      const strategyMatch = line.match(/(?:strategy:|Selected:)\s*(.+)/i);
      if (strategyMatch) {
        bestStrategy = strategyMatch[1].trim();
      }
    }
  }

  return {
    success: true,
    steps,
    optimization: {
      totalOptimized,
      currentAPY,
      bestStrategy,
      lastOptimization: new Date().toISOString(),
    },
    txHashes,
  };
}

function extractStepId(line: string): string {
  if (line.includes('DISCOVERING')) return 'discovery';
  if (line.includes('OWNERSHIP') || line.includes('RT token')) return 'ownership';
  if (line.includes('BALANCE') || line.includes('WIP')) return 'balance';
  if (line.includes('CLAIMING')) return 'claiming';
  if (line.includes('BRIDGING') || line.includes('deBridge')) return 'bridging';
  if (line.includes('DEPOSIT') || line.includes('AutoDeposit')) return 'deposit';
  if (line.includes('OPTIMIZATION') || line.includes('AI')) return 'optimization';
  return 'unknown';
}

function extractStepName(line: string): string {
  if (line.includes('DISCOVERING')) return 'RoyaltyVault Discovery';
  if (line.includes('OWNERSHIP')) return 'Ownership Verification';
  if (line.includes('BALANCE')) return 'Balance Check';
  if (line.includes('CLAIMING')) return 'Royalty Claiming';
  if (line.includes('BRIDGING')) return 'Cross-chain Bridge';
  if (line.includes('DEPOSIT')) return 'Auto-Deposit';
  if (line.includes('OPTIMIZATION')) return 'AI Optimization';
  if (line.includes('DIRECT CLAIM')) return 'Direct Claim';
  return 'Processing';
}

function extractStepDescription(line: string): string {
  if (line.includes('DISCOVERING')) return 'Locating RoyaltyVault for IP Asset';
  if (line.includes('OWNERSHIP')) return 'Checking RT token ownership';
  if (line.includes('BALANCE')) return 'Checking claimable WIP balance';
  if (line.includes('CLAIMING')) return 'Claiming WIP royalties';
  if (line.includes('BRIDGING')) return 'Bridging WIP to USDC on Ethereum';
  if (line.includes('DEPOSIT')) return 'Depositing USDC to optimization vault';
  if (line.includes('OPTIMIZATION')) return 'AI analyzing and executing best strategy';
  if (line.includes('DIRECT CLAIM')) return 'Attempting direct royalty claim';
  return 'Processing step';
}