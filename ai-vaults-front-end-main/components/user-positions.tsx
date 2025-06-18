"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAccount } from "wagmi";

interface VaultPosition {
  vaultId: string;
  vaultName: string;
  blockchain: string;
  chainId: number;
  contractAddress: string;
  shares: bigint;
  sharesFormatted: string;
  estimatedValue: string;
  performance: string;
  isPositive: boolean;
}

export function UserPositions() {
  const { address } = useAccount();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!address) {
      setIsLoading(false);
      return;
    }

    // Simulate loading for better UX
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  }, [address]);

  const getBlockchainColor = (blockchain: string) => {
    switch (blockchain) {
      case "Flow Testnet":
        return "from-green-400 to-emerald-500";
      case "Rootstock Testnet":
        return "from-orange-400 to-red-500";
      default:
        return "from-gray-400 to-gray-500";
    }
  };

  const getBlockchainIcon = (blockchain: string) => {
    switch (blockchain) {
      case "Flow Testnet":
        return "🌊";
      case "Rootstock Testnet":
        return "₿";
      default:
        return "⚡";
    }
  };

  if (!address) {
    return (
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950 opacity-50" />
        <CardContent className="relative p-8 text-center">
          <div className="mb-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-4">
              <span className="text-2xl">💼</span>
            </div>
            <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Connect Your Wallet
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Connect your wallet to view your vault positions and track your
              investments
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 opacity-50" />
        <CardHeader className="relative">
          <CardTitle className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
            Loading Your Positions...
          </CardTitle>
        </CardHeader>
        <CardContent className="relative space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-24 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // Mock positions for demo (you'll replace this with real data)
  const mockPositions: VaultPosition[] = [
    {
      vaultId: "flow-testnet-multi-token-vault",
      vaultName: "Flow Testnet Multi-Token Vault",
      blockchain: "Flow Testnet",
      chainId: 545,
      contractAddress: "0x7C65F77a4EbEa3D56368A73A12234bB4384ACB28",
      shares: BigInt("500000000000000000"), // 0.5 shares
      sharesFormatted: "0.5000",
      estimatedValue: "$523.45",
      performance: "+8.7%",
      isPositive: true,
    },
    {
      vaultId: "rootstock-testnet-vault",
      vaultName: "Rootstock Testnet Vault",
      blockchain: "Rootstock Testnet",
      chainId: 31,
      contractAddress: "0x8fDE7A649c782c96e7f4D9D88490a7C5031F51a9",
      shares: BigInt("750000000000000000"), // 0.75 shares
      sharesFormatted: "0.7500",
      estimatedValue: "$892.16",
      performance: "+15.2%",
      isPositive: true,
    },
  ];

  const totalValue = mockPositions.reduce((sum, pos) => {
    const value = parseFloat(pos.estimatedValue.replace(/[$,]/g, ""));
    return sum + value;
  }, 0);

  const hasPositions = mockPositions.length > 0;

  if (!hasPositions) {
    return (
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 opacity-50" />
        <CardContent className="relative p-8 text-center">
          <div className="mb-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mb-4">
              <span className="text-2xl">🌱</span>
            </div>
            <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Start Your DeFi Journey
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
              You don&apos;t have any vault positions yet. Make your first
              deposit to start earning!
            </p>
            <Button className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white">
              Explore Vaults
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Portfolio Overview */}
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950 opacity-50" />
        <CardHeader className="relative">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <span className="text-white font-bold">💎</span>
              </div>
              <div>
                <h3 className="text-xl font-bold">Your Portfolio</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {mockPositions.length} active position
                  {mockPositions.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                $
                {totalValue.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                Total Value
              </div>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Individual Positions */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">
          Active Positions
        </h3>

        {mockPositions.map((position) => (
          <Card
            key={position.vaultId}
            className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 hover:scale-[1.02]"
          >
            <div
              className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${getBlockchainColor(
                position.blockchain
              )}`}
            />

            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                {/* Left side - Vault info */}
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getBlockchainColor(
                      position.blockchain
                    )} flex items-center justify-center shadow-lg`}
                  >
                    <span className="text-white text-xl">
                      {getBlockchainIcon(position.blockchain)}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white text-lg">
                      {position.vaultName}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="neutral" className="text-xs">
                        {position.blockchain}
                      </Badge>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {position.sharesFormatted} shares
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right side - Value and performance */}
                <div className="text-right">
                  <div className="text-xl font-bold text-slate-900 dark:text-white">
                    {position.estimatedValue}
                  </div>
                  <div
                    className={`text-sm font-medium ${
                      position.isPositive
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {position.isPositive ? "↗️" : "↘️"} {position.performance}
                  </div>
                </div>
              </div>

              {/* Progress bar showing relative size */}
              <div className="mt-4">
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full bg-gradient-to-r ${getBlockchainColor(
                      position.blockchain
                    )} transition-all duration-500`}
                    style={{
                      width: `${
                        (parseFloat(
                          position.estimatedValue.replace(/[$,]/g, "")
                        ) /
                          totalValue) *
                        100
                      }%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <span>Position weight</span>
                  <span>
                    {(
                      (parseFloat(
                        position.estimatedValue.replace(/[$,]/g, "")
                      ) /
                        totalValue) *
                      100
                    ).toFixed(1)}
                    %
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 mt-4">
                <Button
                  size="sm"
                  className={`flex-1 bg-gradient-to-r ${getBlockchainColor(
                    position.blockchain
                  )} hover:opacity-90 text-white`}
                >
                  Deposit More
                </Button>
                <Button size="sm" variant="neutral" className="flex-1">
                  Withdraw
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
