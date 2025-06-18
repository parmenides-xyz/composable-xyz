import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function AIInsights() {
  const insights = [
    {
      id: 1,
      type: "Opportunity",
      title: "Arbitrum Yield Spike",
      description:
        "GMX farming rewards increased by 15%. Consider reallocating to capture higher yields.",
      priority: "High",
      timeAgo: "2 minutes ago",
      icon: "🎯",
      color: "text-green-600 dark:text-green-400",
    },
    {
      id: 2,
      type: "Risk Alert",
      title: "Ethereum Gas Surge",
      description:
        "Network congestion detected. AI recommends pausing rebalancing until fees normalize.",
      priority: "Medium",
      timeAgo: "15 minutes ago",
      icon: "⚠️",
      color: "text-amber-600 dark:text-amber-400",
    },
    {
      id: 3,
      type: "Optimization",
      title: "Portfolio Rebalance",
      description:
        "AI identified 3.2% efficiency gain through cross-chain arbitrage opportunities.",
      priority: "Low",
      timeAgo: "1 hour ago",
      icon: "⚡",
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      id: 4,
      type: "Strategy Update",
      title: "Morpho Blue Integration",
      description:
        "New lending opportunities detected on Morpho Blue with 2% higher efficiency.",
      priority: "Medium",
      timeAgo: "3 hours ago",
      icon: "🔵",
      color: "text-purple-600 dark:text-purple-400",
    },
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "High":
        return "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950";
      case "Medium":
        return "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950";
      case "Low":
        return "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950";
      default:
        return "text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950";
    }
  };

  return (
    <Card className="h-fit">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
              🤖
            </div>
            <CardTitle className="text-lg">AI Insights</CardTitle>
          </div>
          <Badge
            variant="neutral"
            className="bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900 dark:to-emerald-900 text-green-700 dark:text-green-300"
          >
            Real-time
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="max-h-96 overflow-y-auto space-y-3">
          {insights.map((insight) => (
            <div key={insight.id} className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="text-lg mt-0.5">{insight.icon}</div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${insight.color}`}>
                        {insight.type}
                      </span>
                      <Badge
                        className={`text-xs px-2 py-0.5 ${getPriorityColor(
                          insight.priority
                        )}`}
                      >
                        {insight.priority}
                      </Badge>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {insight.timeAgo}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-white text-sm mb-1">
                      {insight.title}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {insight.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-4 space-y-3">
          <Alert className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
            <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
              💡 <strong>AI Tip:</strong> Your portfolio is well-diversified
              across 4 chains. Consider increasing exposure to L2s for higher
              yields.
            </AlertDescription>
          </Alert>

          <Button
            size="sm"
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            📊 View All Insights
          </Button>
        </div>

        <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>AI Analysis Status</span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-green-600 dark:text-green-400 font-medium">
                Active
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
