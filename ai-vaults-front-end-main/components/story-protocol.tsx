"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { isAddress } from "viem";

interface PipelineStep {
  id: string;
  name: string;
  status: "pending" | "in_progress" | "completed" | "error";
  description: string;
  txHash?: string;
  timestamp?: Date | string;
}

interface OptimizationStats {
  totalOptimized: string;
  currentAPY: number;
  bestStrategy: string;
  lastOptimization: Date | string;
}

export function StoryProtocol() {
  const [ipAssetId, setIpAssetId] = useState("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isTriggeringAI, setIsTriggeringAI] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([]);
  const [optimizationStats, setOptimizationStats] = useState<OptimizationStats | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const { address: userAddress } = useAccount();
  const currentChainId = useChainId();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();

  const isValidIpAsset = isAddress(ipAssetId);
  const isStoryProtocolChain = currentChainId === 1514;
  const isEthereumMainnet = currentChainId === 1;

  const fetchVaultStatus = async () => {
    try {
      const response = await fetch('/api/story-protocol/vault-status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.optimization) {
          setOptimizationStats(result.optimization);
        }
      }
    } catch (error) {
      console.error('Failed to fetch vault status:', error);
    }
  };

  const handleTriggerAI = async () => {
    setIsTriggeringAI(true);
    
    try {
      const response = await fetch('/api/story-protocol/trigger-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'AI trigger failed');
      }

      const result = await response.json();
      
      // Update optimization stats if returned
      if (result.optimization) {
        setOptimizationStats(result.optimization);
      }

      console.log('AI optimization triggered successfully:', result);
    } catch (error) {
      console.error('Failed to trigger AI optimization:', error);
    } finally {
      setIsTriggeringAI(false);
    }
  };

  // Fetch vault status on component mount
  useEffect(() => {
    fetchVaultStatus();
  }, []);

  const handleOptimizeRoyalties = async () => {
    if (!isValidIpAsset || !userAddress) return;

    setIsOptimizing(true);
    setTxHash(null);

    // Initialize pipeline steps
    const initialSteps: PipelineStep[] = [
      {
        id: "discovery",
        name: "RoyaltyVault Discovery",
        status: "pending",
        description: "Locating RoyaltyVault for IP Asset"
      },
      {
        id: "ownership",
        name: "Ownership Verification",
        status: "pending",
        description: "Checking RT token ownership"
      },
      {
        id: "balance",
        name: "Balance Check",
        status: "pending",
        description: "Checking claimable WIP balance"
      },
      {
        id: "claiming",
        name: "Royalty Claiming",
        status: "pending",
        description: "Claiming WIP royalties"
      },
      {
        id: "bridging",
        name: "Cross-chain Bridge",
        status: "pending",
        description: "Bridging WIP to USDC on Ethereum"
      },
      {
        id: "deposit",
        name: "Auto-Deposit",
        status: "pending",
        description: "Depositing USDC to optimization vault"
      },
      {
        id: "optimization",
        name: "AI Optimization",
        status: "pending",
        description: "AI analyzing and executing best strategy"
      }
    ];

    setPipelineSteps(initialSteps);

    try {
      // Call the real orchestration API
      const response = await fetch('/api/story-protocol/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ipAssetId,
          userAddress,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Optimization failed');
      }

      const result = await response.json();

      if (result.success) {
        // Update steps based on real results
        if (result.steps && result.steps.length > 0) {
          setPipelineSteps(result.steps);
        } else {
          // Mark all steps as completed if we got a successful result
          setPipelineSteps(prev => prev.map(step => ({
            ...step,
            status: "completed",
            timestamp: new Date(),
          })));
        }

        // Set real optimization stats
        if (result.optimization) {
          setOptimizationStats(result.optimization);
        }

        // Set real transaction hash
        if (result.txHashes && result.txHashes.length > 0) {
          setTxHash(result.txHashes[result.txHashes.length - 1]);
        }
      } else {
        throw new Error(result.error || 'Unknown error occurred');
      }

    } catch (error: unknown) {
      console.error('Optimization error:', error);
      
      // Mark current step as error
      setPipelineSteps(prev => {
        const currentStepIndex = prev.findIndex(step => step.status === "in_progress");
        if (currentStepIndex >= 0) {
          return prev.map((step, index) => 
            index === currentStepIndex 
              ? { ...step, status: "error", timestamp: new Date() }
              : step
          );
        }
        // If no step is in progress, mark the first pending step as error
        const firstPendingIndex = prev.findIndex(step => step.status === "pending");
        if (firstPendingIndex >= 0) {
          return prev.map((step, index) => 
            index === firstPendingIndex 
              ? { ...step, status: "error", timestamp: new Date() }
              : step
          );
        }
        return prev;
      });

      // Show error message to user
      alert(`Optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleSwitchToStoryProtocol = async () => {
    try {
      if (switchChain) {
        await switchChain({ chainId: 1514 });
      }
    } catch (error) {
      console.error("Failed to switch to Story Protocol:", error);
    }
  };

  const handleSwitchToEthereum = async () => {
    try {
      if (switchChain) {
        await switchChain({ chainId: 1 });
      }
    } catch (error) {
      console.error("Failed to switch to Ethereum:", error);
    }
  };

  const getStepIcon = (status: PipelineStep["status"]) => {
    switch (status) {
      case "completed":
        return "✅";
      case "in_progress":
        return "🔄";
      case "error":
        return "❌";
      default:
        return "⏳";
    }
  };

  const getOverallProgress = () => {
    const completedSteps = pipelineSteps.filter(step => step.status === "completed").length;
    return (completedSteps / pipelineSteps.length) * 100;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white">
            Story Protocol Optimization
          </h2>
          <p className="text-sm lg:text-base text-slate-600 dark:text-slate-400">
            Maximize your IP royalties with AI-powered yield optimization
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant={isStoryProtocolChain ? "default" : "neutral"}>
            Story Protocol {isStoryProtocolChain ? "(Connected)" : ""}
          </Badge>
          <Badge variant={isEthereumMainnet ? "default" : "neutral"}>
            Ethereum {isEthereumMainnet ? "(Connected)" : ""}
          </Badge>
        </div>
      </div>

      {/* Network Warnings */}
      {!isStoryProtocolChain && !isEthereumMainnet && (
        <Alert>
          <AlertDescription>
            <div className="space-y-2">
              <p>Please connect to Story Protocol or Ethereum Mainnet to use this feature.</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSwitchToStoryProtocol}
                  disabled={isSwitchingChain}
                >
                  {isSwitchingChain ? "Switching..." : "Switch to Story Protocol"}
                </Button>
                <Button
                  size="sm"
                  variant="neutral"
                  onClick={handleSwitchToEthereum}
                  disabled={isSwitchingChain}
                >
                  {isSwitchingChain ? "Switching..." : "Switch to Ethereum"}
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🎯 IP Asset Optimization
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ip-asset-id">IP Asset ID</Label>
              <Input
                id="ip-asset-id"
                placeholder="0x..."
                value={ipAssetId}
                onChange={(e) => setIpAssetId(e.target.value)}
                disabled={isOptimizing}
                className={isValidIpAsset && ipAssetId ? "border-green-300" : ""}
              />
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Enter the contract address of your IP Asset to optimize its royalties
              </p>
            </div>

            {optimizationStats && (
              <div className="space-y-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-lg border border-green-200 dark:border-green-800">
                <h4 className="text-sm font-medium text-green-800 dark:text-green-200">
                  Current Optimization
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-slate-600 dark:text-slate-400">Total Optimized</p>
                    <p className="font-bold text-green-700 dark:text-green-300">
                      ${optimizationStats.totalOptimized} USDC
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-600 dark:text-slate-400">Current APY</p>
                    <p className="font-bold text-green-700 dark:text-green-300">
                      {optimizationStats.currentAPY}%
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-slate-600 dark:text-slate-400">Best Strategy</p>
                    <p className="font-bold text-green-700 dark:text-green-300">
                      {optimizationStats.bestStrategy}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <Button
              onClick={handleOptimizeRoyalties}
              disabled={!isValidIpAsset || isOptimizing || !userAddress || (!isStoryProtocolChain && !isEthereumMainnet)}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
            >
              {isOptimizing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Optimizing Royalties...
                </>
              ) : (
                "🚀 Optimize Royalties"
              )}
            </Button>

            <Button
              onClick={handleTriggerAI}
              disabled={isTriggeringAI}
              className="w-full border-2 border-green-500 text-green-600 hover:bg-green-50 dark:text-green-400 dark:border-green-400 dark:hover:bg-green-950 bg-transparent"
            >
              {isTriggeringAI ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 mr-2" />
                  Triggering AI...
                </>
              ) : (
                "🤖 Trigger AI Optimization"
              )}
            </Button>

            {!userAddress && (
              <p className="text-xs text-slate-600 dark:text-slate-400 text-center">
                Please connect your wallet to optimize royalties
              </p>
            )}
          </CardContent>
        </Card>

        {/* Pipeline Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              ⚡ Pipeline Status
              {pipelineSteps.length > 0 && (
                <Badge variant="neutral" className="ml-auto">
                  {Math.round(getOverallProgress())}% Complete
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pipelineSteps.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <div className="text-4xl mb-2">🔮</div>
                <p>Enter an IP Asset ID above to start optimization</p>
              </div>
            ) : (
              <>
                <Progress value={getOverallProgress()} className="h-2" />
                
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {pipelineSteps.map((step) => (
                    <div
                      key={step.id}
                      className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                        step.status === "in_progress"
                          ? "bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800"
                          : step.status === "completed"
                          ? "bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800"
                          : step.status === "error"
                          ? "bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800"
                          : "bg-slate-50 dark:bg-slate-800"
                      }`}
                    >
                      <span className="text-lg mt-0.5">{getStepIcon(step.status)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {step.name}
                          </p>
                          {step.timestamp && (
                            <span className="text-xs text-slate-500">
                              {new Date(step.timestamp).toLocaleTimeString()}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                          {step.description}
                        </p>
                        {step.txHash && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-mono">
                            {step.txHash.slice(0, 10)}...{step.txHash.slice(-8)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle>🔧 How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="text-2xl">📚</div>
              <h3 className="font-semibold">1. Discover & Verify</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                We locate your RoyaltyVault and verify your RT token ownership for the IP Asset.
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-2xl">🌉</div>
              <h3 className="font-semibold">2. Claim & Bridge</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Claim your WIP royalties and bridge them to USDC on Ethereum mainnet for optimization.
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-2xl">🤖</div>
              <h3 className="font-semibold">3. AI Optimization</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Our AI analyzes DeFi markets and deploys your funds to the highest-yielding strategies.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Success Message */}
      {txHash && optimizationStats && (
        <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <AlertDescription className="text-sm text-green-800 dark:text-green-200">
            🎉 <strong>Optimization Complete!</strong> Your royalties have been successfully optimized and are now earning {optimizationStats.currentAPY}% APY through {optimizationStats.bestStrategy}.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}