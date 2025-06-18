import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Protocol {
  id: string;
  name: string;
  description: string;
  blockchain: string[];
  category: string;
  tvl: string;
  apy: string;
  status: "active" | "maintenance" | "new";
  logo: string;
}

export function ProtocolList() {
  const protocols: Protocol[] = [
    {
      id: "1",
      name: "Aave V3",
      description:
        "Decentralized lending protocol with cross-chain capabilities",
      blockchain: ["Ethereum"],
      category: "Lending",
      tvl: "$25.2B",
      apy: "3.28%",
      status: "active",
      logo: "👻",
    },
    {
      id: "2",
      name: "Compound V3",
      description:
        "Algorithmic money market protocol for lending and borrowing",
      blockchain: ["Ethereum"],
      category: "Lending",
      tvl: "$502M",
      apy: "3.12%",
      status: "active",
      logo: "💚",
    },
    {
      id: "3",
      name: "Morpho Blue",
      description:
        "Optimized lending and borrowing with enhanced capital efficiency",
      blockchain: ["Ethereum"],
      category: "Lending",
      tvl: "$1.2B",
      apy: "TBD",
      status: "new",
      logo: "🔵",
    },
    {
      id: "4",
      name: "Stargate",
      description: "Cross-chain bridge protocol for seamless asset transfers",
      blockchain: ["Ethereum", "Story"],
      category: "Bridge",
      tvl: "$320M",
      apy: "TBD",
      status: "new",
      logo: "🌟",
    },
    {
      id: "5",
      name: "deBridge",
      description: "High-performance cross-chain infrastructure and liquidity transfer",
      blockchain: ["Ethereum", "Story"],
      category: "Bridge",
      tvl: "$8.5B+",
      apy: "TBD",
      status: "new",
      logo: "🌉",
    },
    {
      id: "6",
      name: "PiperX",
      description: "Story-native perpetual exchange for IP asset derivatives",
      blockchain: ["Story"],
      category: "Perp Trading",
      tvl: "TBD",
      apy: "TBD",
      status: "new",
      logo: "🎭",
    },
    {
      id: "7",
      name: "Unleash Protocol",
      description: "Decentralized marketplace for intellectual property",
      blockchain: ["Story"],
      category: "IP Marketplace",
      tvl: "TBD",
      apy: "TBD",
      status: "new",
      logo: "🚀",
    },
    {
      id: "8",
      name: "StoryHunt",
      description: "Gamified IP discovery and yield optimization platform",
      blockchain: ["Story"],
      category: "IP Gaming",
      tvl: "TBD",
      apy: "TBD",
      status: "new",
      logo: "🏹",
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "maintenance":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "new":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300";
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Lending":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "DEX":
        return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300";
      case "Perp Trading":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "Bridge":
        return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300";
      case "IP Marketplace":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300";
      case "IP Gaming":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300";
    }
  };

  const getBlockchainColor = (blockchain: string) => {
    switch (blockchain) {
      case "Ethereum":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "Story":
        return "bg-gradient-to-r from-purple-100 to-cyan-100 text-purple-800 dark:from-purple-900 dark:to-cyan-900 dark:text-purple-300";
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
    <Card className="story-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="parmenidean-wisdom text-xl">∞ THE FORMS OF PROTOCOL</CardTitle>
            <p className="text-sm text-cyan-300/80 mt-1 uppercase tracking-wide pixel-text">
              Eternal DeFi patterns manifesting perfect yield optimization
            </p>
          </div>
          <Badge className="eternal-form text-white font-mono text-xs px-3 py-1">
            {protocols.filter(p => p.status === 'active').length} ACTIVE • {protocols.filter(p => p.status === 'new').length} COMING SOON
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {protocols.map((protocol) => (
            <div
              key={protocol.id}
              className="p-4 rounded-lg story-card hover:eternal-form transition-all duration-300 cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{protocol.logo}</span>
                  <div>
                    <h4 className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 text-sm pixel-text group-hover:text-white transition-all">
                      {protocol.name}
                    </h4>
                    <Badge
                      className={`text-xs ${getCategoryColor(
                        protocol.category
                      )}`}
                    >
                      {protocol.category}
                    </Badge>
                  </div>
                </div>
                <Badge className={`text-xs ${getStatusColor(protocol.status)}`}>
                  {protocol.status}
                </Badge>
              </div>

              <p className="text-xs text-purple-300/80 mb-3 leading-relaxed font-mono group-hover:text-cyan-200 transition-all">
                {protocol.description}
              </p>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-purple-400/80 font-mono text-xs uppercase tracking-wider">
                    TVL
                  </span>
                  <span className="font-bold text-cyan-300 font-mono">
                    {protocol.tvl}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-purple-400/80 font-mono text-xs uppercase tracking-wider">
                    APY
                  </span>
                  <span className="font-bold text-emerald-400 font-mono">
                    {protocol.apy}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 mt-3">
                {protocol.blockchain.map((chain) => (
                  <Badge
                    key={chain}
                    className={`text-xs px-1.5 py-0.5 ${getBlockchainColor(
                      chain
                    )}`}
                  >
                    {chain}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
