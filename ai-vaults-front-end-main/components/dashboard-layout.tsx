"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { VaultCard } from "@/components/vault-card";
import { StatsOverview } from "@/components/stats-overview";
import { NavBar } from "@/components/nav-bar";
import { ProtocolList } from "@/components/protocol-list";
import { CreateVaultModal } from "@/components/create-vault-modal";
import { StoryProtocol } from "@/components/story-protocol";
import { getVaultAddress } from "@/constants/contracts";
import { getVaults } from "@/lib/supabase";
import { useChainId } from "wagmi";

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

interface SupabaseVault {
  id: number;
  vaultaddress: string;
  blockchain: string;
  nombre: string;
  symbol: string;
}

// Real vault data based on deployed contracts - Ethereum Mainnet Only
const REAL_VAULTS: VaultData[] = [
  {
    id: "ethereum-mainnet-vault",
    name: "Ethereum Ontology Vault",
    description:
      "AI-powered USDC vault on Ethereum Mainnet for eternal yield optimization",
    blockchain: "Ethereum Mainnet",
    chainId: 1,
    contractAddress:
      getVaultAddress("mainnet", "OptimizationVault") ||
      "0x670d84987005083dE65C07672241f46dA678D24A",
    apy: 8.4,
    tvl: 17000,
    riskLevel: "Medium",
    aiStrategy: "AI-Powered Eternal Yield Forms",
    performance: 12.7,
    deposits: 17020,
    allocation: {
      "Aave V3 USDC": 85,
      "Compound V3 USDC": 15,
    },
    supportedTokens: ["USDC"],
  },
];

export function DashboardLayout() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCreateVaultModalOpen, setIsCreateVaultModalOpen] = useState(false);
  const [supabaseVaults, setSupabaseVaults] = useState<VaultData[]>([]);
  const [isLoadingVaults, setIsLoadingVaults] = useState(true);
  const [selectedVault, setSelectedVault] = useState<VaultData | null>(null);

  // Get current chain ID to filter vaults and faucet
  const currentChainId = useChainId();

  // Combine hardcoded vaults with Supabase vaults and filter by current chain
  const allVaults = [...REAL_VAULTS, ...supabaseVaults];
  const filteredVaults = allVaults.filter(
    (vault) => vault.chainId === currentChainId
  );

  // Update selectedVault when filteredVaults changes
  useEffect(() => {
    if (
      filteredVaults.length > 0 &&
      (!selectedVault || !filteredVaults.find((v) => v.id === selectedVault.id))
    ) {
      setSelectedVault(filteredVaults[0]);
    } else if (filteredVaults.length === 0) {
      setSelectedVault(null);
    }
  }, [filteredVaults, selectedVault]);

  // Map Supabase vault to VaultData format
  const mapSupabaseVaultToVaultData = (vault: SupabaseVault): VaultData => {
    // Get chain ID based on blockchain name - Only Ethereum Mainnet supported
    const getChainIdFromBlockchain = (blockchain: string): number => {
      switch (blockchain.toLowerCase()) {
        case "ethereum":
        case "ethereum mainnet":
        case "mainnet":
          return 1;
        case "story":
        case "story mainnet":
        case "story protocol":
          return 1514; // Story mainnet (coming soon)
        default:
          return 1; // Default to Ethereum mainnet
      }
    };

    const chainId = getChainIdFromBlockchain(vault.blockchain);

    return {
      id: `supabase-${vault.id}`,
      name: vault.nombre,
      description: `AI-managed vault created by users on ${vault.blockchain}`,
      blockchain: vault.blockchain,
      chainId,
      contractAddress: vault.vaultaddress,
      apy: 12.5, // Default values for user-created vaults
      tvl: 0, // Will be updated when we can read from contract
      riskLevel: "Medium",
      aiStrategy: "AI-Powered Multi-Asset Strategy",
      performance: 8.7,
      deposits: 0,
      allocation: {
        "USDC Strategies": 100, // Since all user vaults use USDC
      },
      supportedTokens: ["MockUSDC"], // All user vaults support USDC
    };
  };

  const goToFaucet = () => {
    setActiveTab("faucet");
    setIsMobileMenuOpen(false);
  };

  // Load vaults from Supabase
  const loadSupabaseVaults = async () => {
    try {
      setIsLoadingVaults(true);
      const vaults = await getVaults();
      const mappedVaults = vaults.map(mapSupabaseVaultToVaultData);
      setSupabaseVaults(mappedVaults);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('Supabase not configured')) {
        console.log("Supabase not configured - skipping vault loading");
        setSupabaseVaults([]);
      } else {
        console.error("Error loading vaults from Supabase:", error);
      }
    } finally {
      setIsLoadingVaults(false);
    }
  };

  // Load vaults on component mount
  useEffect(() => {
    loadSupabaseVaults();
  }, []);

  // Reload vaults when modal closes (in case a new vault was created)
  useEffect(() => {
    if (!isCreateVaultModalOpen) {
      loadSupabaseVaults();
    }
  }, [isCreateVaultModalOpen]);

  return (
    <div className="min-h-screen retro-grid">
      <div className="flex flex-col lg:flex-row">
        {/* Mobile Header */}
        <div className="lg:hidden">
          <NavBar />
          <div className="flex items-center justify-between p-4 story-card border-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 eternal-form rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm pixel-text">Ω</span>
              </div>
              <div>
                <h1 className="parmenidean-wisdom text-lg">
                  Ontology Finance
                </h1>
                <p className="text-xs text-purple-300/80 uppercase tracking-widest">
                  The Being of DeFi
                </p>
              </div>
            </div>
            <Button
              variant="neutral"
              size="sm"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden"
            >
              {isMobileMenuOpen ? "✕" : "☰"}
            </Button>
          </div>

          {/* Mobile Navigation */}
          {isMobileMenuOpen && (
            <div className="p-4 bg-white/95 dark:bg-slate-950/95 border-b border-slate-200/60 dark:border-slate-800/60">
              <nav className="grid grid-cols-2 gap-2 mb-4">
                <Button
                  variant={activeTab === "overview" ? "default" : "neutral"}
                  className="text-xs"
                  onClick={() => {
                    setActiveTab("overview");
                    setIsMobileMenuOpen(false);
                  }}
                >
                  ∞ Eternal Yield
                </Button>
                <Button
                  variant={activeTab === "story" ? "default" : "neutral"}
                  className="text-xs"
                  onClick={() => {
                    setActiveTab("story");
                    setIsMobileMenuOpen(false);
                  }}
                >
                  📜 Story Protocol
                </Button>
              </nav>

              <div className="grid grid-cols-1 gap-2">
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-xs"
                  onClick={() => {
                    setIsCreateVaultModalOpen(true);
                    setIsMobileMenuOpen(false);
                  }}
                >
                  🚀 Deploy New Vault
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="neutral" className="text-xs">
                    💰 Add Funds
                  </Button>
                  <Button size="sm" variant="neutral" className="text-xs">
                    📤 Withdraw
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Desktop Sidebar */}
        <div className="hidden lg:block w-80 flex-shrink-0 story-card border-r-0 rounded-none">
          <div className="p-6 h-screen overflow-y-auto">
            <div className="flex items-center gap-3 mb-8 being-aura">
              <div className="w-10 h-10 eternal-form rounded-lg flex items-center justify-center cubist-geometry">
                <span className="text-white font-bold text-lg pixel-text">Ω</span>
              </div>
              <div>
                <h1 className="parmenidean-wisdom text-xl">
                  Ontology Finance
                </h1>
                <p className="text-sm text-cyan-300/80 uppercase tracking-widest">
                  The Being of DeFi
                </p>
              </div>
            </div>

            <nav className="space-y-3">
              <Button
                variant={activeTab === "overview" ? "default" : "neutral"}
                className={`w-full justify-start retro-8bit text-xs py-3 ${
                  activeTab === "overview" ? "eternal-form" : "story-card"
                }`}
                onClick={() => setActiveTab("overview")}
              >
                ∞ ETERNAL YIELD
              </Button>
              <Button
                variant={activeTab === "story" ? "default" : "neutral"}
                className={`w-full justify-start retro-8bit text-xs py-3 ${
                  activeTab === "story" ? "eternal-form" : "story-card"
                }`}
                onClick={() => setActiveTab("story")}
              >
                📜 STORY PROTOCOL
              </Button>
            </nav>

            <div className="mt-8">
              <div className="story-card cyberpunk-border p-4">
                <p className="parmenidean-wisdom text-xs text-center">
                  ∞ Being is eternal, unchanging. Your yield optimization continues its perfect form.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-h-screen">
          {/* Desktop NavBar */}
          <div className="hidden lg:block">
            <NavBar />
          </div>

          <main className="flex-1 p-3 sm:p-4 lg:p-6">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full h-full"
            >
              <TabsContent
                value="overview"
                className="space-y-4 lg:space-y-6 mt-0"
              >
                {/* Stats Overview */}
                <StatsOverview vaults={filteredVaults} />

                {/* Loading indicator */}
                {isLoadingVaults && (
                  <div className="flex items-center justify-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-2 text-slate-600 dark:text-slate-400">
                      Loading vaults...
                    </span>
                  </div>
                )}

                {/* Vaults Section */}
                <div className="space-y-4 lg:space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h2 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white">
                        Your Active Vaults
                      </h2>
                      <p className="text-sm lg:text-base text-cyan-300/80 uppercase tracking-wide">
                        Eternal Forms of Yield Optimization
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 w-full sm:w-auto"
                      onClick={() => setIsCreateVaultModalOpen(true)}
                    >
                      🚀 Create New Vault
                    </Button>
                  </div>

                  {!isLoadingVaults && filteredVaults.length === 0 ? (
                    <div className="text-center py-12">
                      <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950 max-w-lg mx-auto">
                        <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                          <div className="flex flex-col items-center gap-3">
                            <span className="text-3xl">🏦</span>
                            <div>
                              <strong>
                                No eternal forms manifest on this network
                              </strong>
                              <p className="mt-1 text-sm">
                                Switch to Ethereum Mainnet to access the Ontology
                                vault, or create a new vault on your current network.
                              </p>
                            </div>
                          </div>
                        </AlertDescription>
                      </Alert>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 lg:gap-6">
                      {filteredVaults.map((vault) => (
                        <VaultCard
                          goToFaucet={goToFaucet}
                          key={vault.id}
                          vault={vault}
                          onSelect={() => setSelectedVault(vault)}
                          isSelected={selectedVault?.id === vault.id}
                        />
                      ))}
                    </div>
                  )}

                  {/* Protocol Integrations */}
                  <ProtocolList />
                </div>
              </TabsContent>


              <TabsContent
                value="story"
                className="space-y-4 lg:space-y-6 mt-0"
              >
                <StoryProtocol />
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </div>

      {/* Create Vault Modal */}
      <CreateVaultModal
        isOpen={isCreateVaultModalOpen}
        onOpenChange={setIsCreateVaultModalOpen}
      />
    </div>
  );
}
