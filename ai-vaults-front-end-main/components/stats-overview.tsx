import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

interface StatsOverviewProps {
  vaults: VaultData[];
}

type ChangeType = "positive" | "negative" | "neutral";

export function StatsOverview({ vaults }: StatsOverviewProps) {
  const totalTVL = vaults.reduce((sum, vault) => sum + vault.tvl, 0);
  const totalDeposits = vaults.reduce((sum, vault) => sum + vault.deposits, 0);
  const avgAPY =
    vaults.reduce((sum, vault) => sum + vault.apy, 0) / vaults.length;
  const avgPerformance =
    vaults.reduce((sum, vault) => sum + vault.performance, 0) / vaults.length;

  const stats = [
    {
      title: "Total Value Locked",
      value: `$${(totalTVL / 1000000).toFixed(1)}M`,
      change: "+12.5%",
      changeType: "positive" as ChangeType,
      icon: "🏦",
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      title: "Your Deposits",
      value: `$${(totalDeposits / 1000000).toFixed(1)}M`,
      change: "+8.2%",
      changeType: "positive" as ChangeType,
      icon: "💰",
      gradient: "from-green-500 to-emerald-500",
    },
    {
      title: "Average APY",
      value: `${avgAPY.toFixed(1)}%`,
      change: "+2.1%",
      changeType: "positive" as ChangeType,
      icon: "📈",
      gradient: "from-purple-500 to-pink-500",
    },
    {
      title: "Portfolio Performance",
      value: `+${avgPerformance.toFixed(1)}%`,
      change: "24h",
      changeType: "neutral" as ChangeType,
      icon: "⚡",
      gradient: "from-orange-500 to-red-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <Card
          key={index}
          className="relative overflow-hidden group hover:shadow-lg transition-all duration-300"
        >
          <div
            className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-5 group-hover:opacity-10 transition-opacity`}
          />

          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {stat.title}
            </CardTitle>
            <div
              className={`text-2xl p-2 rounded-lg bg-gradient-to-br ${stat.gradient} text-white shadow-sm`}
            >
              {stat.icon}
            </div>
          </CardHeader>

          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
              {stat.value}
            </div>
            <p
              className={`text-xs flex items-center gap-1 ${
                stat.changeType === "positive"
                  ? "text-green-600 dark:text-green-400"
                  : stat.changeType === "negative"
                  ? "text-red-600 dark:text-red-400"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {stat.changeType === "positive" && "↗️"}
              {stat.changeType === "negative" && "↘️"}
              {stat.changeType === "neutral" && "📊"}
              <span className="font-medium">{stat.change}</span>
              {stat.changeType !== "neutral" && " from last week"}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
