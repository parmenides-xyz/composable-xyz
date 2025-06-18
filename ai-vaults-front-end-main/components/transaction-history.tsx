import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Transaction {
  id: string;
  type: "deposit" | "withdraw" | "rebalance" | "reward";
  vault: string;
  blockchain: string;
  amount: string;
  status: "completed" | "pending" | "failed";
  timestamp: string;
  hash: string;
}

export function TransactionHistory() {
  const transactions: Transaction[] = [
    {
      id: "1",
      type: "deposit",
      vault: "Ethereum Prime Vault",
      blockchain: "Ethereum",
      amount: "+$25,000 USDC",
      status: "completed",
      timestamp: "2 hours ago",
      hash: "0x8f7a...3b2c",
    },
    {
      id: "2",
      type: "rebalance",
      vault: "Arbitrum Velocity Vault",
      blockchain: "Arbitrum",
      amount: "Portfolio Rebalance",
      status: "completed",
      timestamp: "4 hours ago",
      hash: "0x5d9e...7f1a",
    },
    {
      id: "3",
      type: "reward",
      vault: "Polygon Stable Vault",
      blockchain: "Polygon",
      amount: "+$142.50 USDT",
      status: "completed",
      timestamp: "1 day ago",
      hash: "0x2c4f...9e8d",
    },
    {
      id: "4",
      type: "withdraw",
      vault: "Optimism Growth Vault",
      blockchain: "Optimism",
      amount: "-$5,000 DAI",
      status: "pending",
      timestamp: "2 days ago",
      hash: "0x1a3b...4c5d",
    },
    {
      id: "5",
      type: "deposit",
      vault: "Ethereum Prime Vault",
      blockchain: "Ethereum",
      amount: "+$10,000 USDC",
      status: "failed",
      timestamp: "3 days ago",
      hash: "0x9f2e...8a7b",
    },
  ];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "deposit":
        return "💰";
      case "withdraw":
        return "📤";
      case "rebalance":
        return "⚖️";
      case "reward":
        return "🎁";
      default:
        return "📊";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "deposit":
        return "text-green-600 dark:text-green-400";
      case "withdraw":
        return "text-red-600 dark:text-red-400";
      case "rebalance":
        return "text-blue-600 dark:text-blue-400";
      case "reward":
        return "text-purple-600 dark:text-purple-400";
      default:
        return "text-slate-600 dark:text-slate-400";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "failed":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300";
    }
  };

  const getBlockchainColor = (blockchain: string) => {
    switch (blockchain) {
      case "Ethereum":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "Arbitrum":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "Polygon":
        return "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-300";
      case "Optimism":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Transaction History</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="neutral">
              📁 Filter
            </Button>
            <Button size="sm" variant="neutral">
              📄 Export
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between p-4 rounded-lg bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors border border-slate-200/50 dark:border-slate-800/50"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`text-2xl p-2 rounded-lg bg-white dark:bg-slate-800 shadow-sm`}
                >
                  {getTypeIcon(tx.type)}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-medium capitalize ${getTypeColor(
                        tx.type
                      )}`}
                    >
                      {tx.type}
                    </span>
                    <Badge className={getBlockchainColor(tx.blockchain)}>
                      {tx.blockchain}
                    </Badge>
                    <Badge className={getStatusColor(tx.status)}>
                      {tx.status}
                    </Badge>
                  </div>

                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    {tx.vault}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>{tx.timestamp}</span>
                    <span>•</span>
                    <span className="font-mono">{tx.hash}</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div
                  className={`font-medium ${
                    tx.amount.startsWith("+")
                      ? "text-green-600 dark:text-green-400"
                      : tx.amount.startsWith("-")
                      ? "text-red-600 dark:text-red-400"
                      : "text-slate-900 dark:text-white"
                  }`}
                >
                  {tx.amount}
                </div>
                <Button size="sm" variant="neutral" className="mt-2">
                  🔗 View
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center pt-6">
          <Button variant="neutral" className="w-full max-w-sm">
            📜 Load More Transactions
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
