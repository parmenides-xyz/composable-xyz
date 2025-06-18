import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { DepositModal } from "./deposit-modal";

interface VaultData {
  id: string;
  name: string;
  description: string;
  blockchain: string;
  chainId: number;
  contractAddress: string;
  apy: number;
  tvl: number;
  riskLevel: string;
  aiStrategy: string;
  performance: number;
  deposits: number;
  allocation: Record<string, number>;
  supportedTokens: string[];
}

interface VaultCardProps {
  vault: VaultData;
  onSelect: () => void;
  isSelected: boolean;
  showFullDetails?: boolean;
  goToFaucet: () => void;
}

const getBlockchainColor = (blockchain: string) => {
  switch (blockchain.toLowerCase()) {
    case "ethereum":
      return "from-blue-500 via-blue-600 to-blue-700";
    case "arbitrum":
      return "from-purple-500 via-purple-600 to-purple-700";
    case "polygon":
      return "from-violet-500 via-violet-600 to-violet-700";
    case "optimism":
      return "from-red-500 via-red-600 to-red-700";
    case "base":
      return "from-blue-400 via-indigo-500 to-indigo-600";
    case "flow testnet":
    case "flowTestnet":
      return "from-emerald-400 via-green-500 to-green-600";
    case "rootstock testnet":
    case "rootstockTestnet":
      return "from-orange-400 via-orange-500 to-orange-600";
    default:
      return "from-slate-400 via-slate-500 to-slate-600";
  }
};

const getBlockchainIcon = (blockchain: string) => {
  switch (blockchain.toLowerCase()) {
    case "ethereum":
      return "⟠";
    case "arbitrum":
      return "🅰️";
    case "polygon":
      return "🔷";
    case "optimism":
      return "🔴";
    case "base":
      return "🔵";
    case "flow testnet":
    case "flowTestnet":
      return "🌊";
    case "rootstock testnet":
    case "rootstockTestnet":
      return "₿";
    default:
      return "⚡";
  }
};

const getRiskColor = (risk: string) => {
  switch (risk) {
    case "Low":
      return "bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border-green-200 dark:from-green-900/50 dark:to-emerald-900/50 dark:text-green-300 dark:border-green-700";
    case "Medium":
      return "bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-700 border-yellow-200 dark:from-yellow-900/50 dark:to-amber-900/50 dark:text-yellow-300 dark:border-yellow-700";
    case "High":
      return "bg-gradient-to-r from-red-100 to-rose-100 text-red-700 border-red-200 dark:from-red-900/50 dark:to-rose-900/50 dark:text-red-300 dark:border-red-700";
    default:
      return "bg-gradient-to-r from-slate-100 to-gray-100 text-slate-700 border-slate-200 dark:from-slate-900/50 dark:to-gray-900/50 dark:text-slate-300 dark:border-slate-700";
  }
};

export function VaultCard({
  vault,
  onSelect,
  isSelected,
  showFullDetails,
  goToFaucet,
}: VaultCardProps) {
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Card
      className={`group relative cursor-pointer transition-all duration-500 ease-out overflow-hidden h-full flex flex-col
        ${
          isSelected
            ? "ring-2 ring-blue-500/50 shadow-2xl shadow-blue-500/25 scale-[1.02] bg-gradient-to-br from-blue-50/80 to-indigo-50/80 dark:from-blue-950/50 dark:to-indigo-950/50"
            : "hover:shadow-xl hover:shadow-slate-200/60 dark:hover:shadow-slate-800/60 hover:scale-[1.01]"
        }
        bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60`}
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Animated gradient background */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${getBlockchainColor(
          vault.blockchain
        )} opacity-[0.02] transition-opacity duration-500
          ${isHovered ? "opacity-[0.05]" : ""}`}
      />

      {/* Top gradient accent */}
      <div
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${getBlockchainColor(
          vault.blockchain
        )} 
          transition-all duration-500 ${isHovered ? "h-2" : ""}`}
      />

      {/* Floating indicators */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <Badge
          className={`${getRiskColor(
            vault.riskLevel
          )} border text-xs font-medium px-2 py-1`}
        >
          {vault.riskLevel}
        </Badge>
      </div>

      <CardHeader className="pb-4 pt-6 flex-shrink-0">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getBlockchainColor(
                vault.blockchain
              )} 
              flex items-center justify-center text-white font-bold text-lg shadow-lg
              transition-transform duration-300 group-hover:scale-110`}
            >
              {getBlockchainIcon(vault.blockchain)}
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                {vault.name}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant="neutral"
                  className="text-xs bg-slate-100/80 dark:bg-slate-800/80"
                >
                  {vault.blockchain}
                </Badge>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  ID: {vault.chainId}
                </span>
              </div>
            </div>
          </div>
        </div>

        <CardDescription className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
          {vault.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col">
        <div className="flex-1 space-y-5">
          {/* Main metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-50 via-green-50 to-emerald-100 dark:from-emerald-950/50 dark:via-green-950/50 dark:to-emerald-900/50 p-4 border border-emerald-200/50 dark:border-emerald-800/50">
              <div className="relative z-10">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {vault.apy.toFixed(1)}%
                </div>
                <div className="text-xs text-emerald-600/80 dark:text-emerald-400/80 font-semibold uppercase tracking-wide">
                  APY
                </div>
              </div>
              <div className="absolute -top-2 -right-2 text-4xl opacity-10">
                📈
              </div>
            </div>

            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-100 dark:from-blue-950/50 dark:via-indigo-950/50 dark:to-blue-900/50 p-4 border border-blue-200/50 dark:border-blue-800/50">
              <div className="relative z-10">
                <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  $
                  {vault.tvl >= 1000000
                    ? `${(vault.tvl / 1000000).toFixed(1)}M`
                    : `${(vault.tvl / 1000).toFixed(0)}K`}
                </div>
                <div className="text-xs text-blue-600/80 dark:text-blue-400/80 font-semibold uppercase tracking-wide">
                  TVL
                </div>
              </div>
              <div className="absolute -top-2 -right-2 text-4xl opacity-10">
                💰
              </div>
            </div>
          </div>

          {/* Performance section */}
          <div className="space-y-3 p-4 rounded-xl bg-gradient-to-r from-slate-50/50 to-slate-100/50 dark:from-slate-900/30 dark:to-slate-800/30 border border-slate-200/50 dark:border-slate-700/50">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                🎯 Performance
              </span>
              <span
                className={`font-bold text-sm ${
                  vault.performance >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {vault.performance >= 0 ? "+" : ""}
                {vault.performance.toFixed(1)}%
              </span>
            </div>
            <Progress
              value={Math.min(Math.max((vault.performance / 20) * 100, 0), 100)}
              className="h-2 bg-slate-200 dark:bg-slate-700"
            />
          </div>

          {/* AI Strategy */}
          <div className="p-3 rounded-lg bg-gradient-to-r from-violet-50/50 to-purple-50/50 dark:from-violet-950/30 dark:to-purple-950/30 border border-violet-200/50 dark:border-violet-800/50">
            <div className="text-xs font-semibold text-violet-700 dark:text-violet-300 mb-1 flex items-center gap-1">
              🤖 AI Strategy
            </div>
            <div className="text-xs text-violet-600/90 dark:text-violet-400/90 leading-relaxed">
              {vault.aiStrategy}
            </div>
          </div>

          {showFullDetails && (
            <div className="space-y-4 pt-4 border-t border-slate-200/60 dark:border-slate-700/60">
              {/* Strategy Allocation */}
              <div>
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                  📊 Strategy Allocation
                </div>
                <div className="space-y-3">
                  {Object.entries(vault.allocation).map(
                    ([strategy, percentage]) => (
                      <div key={strategy} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400 font-medium">
                            {strategy}
                          </span>
                          <span className="text-slate-900 dark:text-white font-bold">
                            {percentage}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-700 ease-out"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Supported Tokens */}
              <div>
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                  🪙 Supported Assets
                </div>
                <div className="flex flex-wrap gap-2">
                  {vault.supportedTokens.map((token) => (
                    <Badge
                      key={token}
                      variant="neutral"
                      className="text-xs bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 border border-slate-300/50 dark:border-slate-600/50"
                    >
                      {token.replace("Mock", "")}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Contract Information */}
              <div className="p-3 rounded-lg bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-700/50">
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                  📋 Contract Details
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-400">
                      Chain ID:
                    </span>
                    <span className="font-mono text-slate-900 dark:text-white bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded">
                      {vault.chainId}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-400">
                      Contract:
                    </span>
                    <span className="font-mono text-slate-900 dark:text-white bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded">
                      {vault.contractAddress.slice(0, 6)}...
                      {vault.contractAddress.slice(-4)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons - Always at bottom */}
        <div className="pt-4 mt-auto">
          <Button
            size="sm"
            className="w-full bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 hover:from-blue-700 hover:via-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] relative z-10"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDepositModalOpen(true);
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
          >
            <span className="mr-2">💰</span>
            Deposit
          </Button>
        </div>
      </CardContent>

      {/* Deposit Modal */}
      <DepositModal
        goToFaucet={goToFaucet}
        isOpen={isDepositModalOpen}
        onOpenChange={setIsDepositModalOpen}
        vault={vault}
      />
    </Card>
  );
}
