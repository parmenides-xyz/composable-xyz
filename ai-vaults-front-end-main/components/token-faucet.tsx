"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
  useSwitchChain,
  useReadContract,
} from "wagmi";
import { parseUnits, formatUnits, Address } from "viem";
import { getChainConfigById } from "@/constants/contracts";

// Mock USDC Token ABI with faucet function
const MOCK_USDC_ABI = [
  {
    name: "faucet",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// Available chains with faucets
const FAUCET_CHAINS = [
  {
    id: 545,
    name: "Flow Testnet",
    icon: "🌊",
    color: "from-green-400 to-emerald-500",
  },
  {
    id: 31,
    name: "Rootstock Testnet",
    icon: "₿",
    color: "from-orange-400 to-red-500",
  },
];

interface ChainFaucetProps {
  chainId: number;
  chainName: string;
  icon: string;
  color: string;
}

function ChainFaucet({ chainId, chainName, icon, color }: ChainFaucetProps) {
  const [amount, setAmount] = useState<string>("1000");
  const [lastFaucetHash, setLastFaucetHash] = useState<string>("");

  const { address: userAddress } = useAccount();
  const currentChainId = useChainId();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();

  const {
    writeContract: writeFaucet,
    data: faucetHash,
    isPending: isFaucetPending,
  } = useWriteContract();

  // Get USDC token address for this chain
  const chainInfo = getChainConfigById(chainId);
  const usdcAddress = chainInfo?.config.tokens.MockUSDC;

  // Get user's USDC balance
  const { data: usdcBalance, refetch: refetchBalance } = useReadContract({
    address: usdcAddress as Address,
    abi: MOCK_USDC_ABI,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!usdcAddress && !!userAddress },
  });

  // Wait for faucet transaction confirmation
  const { isLoading: isFaucetConfirming, isSuccess: isFaucetSuccess } =
    useWaitForTransactionReceipt({
      hash: faucetHash,
    });

  // Update last faucet hash and refetch balance on success
  useEffect(() => {
    if (isFaucetSuccess && faucetHash) {
      setLastFaucetHash(faucetHash);
      // Refetch balance after successful faucet
      setTimeout(() => {
        refetchBalance();
      }, 2000);
    }
  }, [isFaucetSuccess, faucetHash, refetchBalance]);

  const handleSwitchChain = async () => {
    try {
      await switchChain({ chainId });
    } catch (error) {
      console.error("Failed to switch chain:", error);
    }
  };

  const handleFaucet = async () => {
    if (!usdcAddress || !userAddress || !amount) return;

    const amountInWei = parseUnits(amount, 6); // USDC has 6 decimals
    const maxAmount = parseUnits("10000", 6); // 10,000 USDC limit

    if (amountInWei > maxAmount) {
      alert("Maximum 10,000 USDC per faucet request");
      return;
    }

    try {
      writeFaucet({
        address: usdcAddress as Address,
        abi: MOCK_USDC_ABI,
        functionName: "faucet",
        args: [amountInWei],
      });
    } catch (error) {
      console.error("Faucet failed:", error);
    }
  };

  const formatBalance = (balance: bigint) => {
    return parseFloat(formatUnits(balance, 6)).toFixed(2);
  };

  const isCorrectChain = currentChainId === chainId;
  const isFaucetInProgress = isFaucetPending || isFaucetConfirming;

  const getExplorerUrl = (txHash: string) => {
    return chainId === 31
      ? `https://explorer.testnet.rsk.co/tx/${txHash}`
      : `https://evm-testnet.flowscan.io/tx/${txHash}`;
  };

  return (
    <Card className="relative overflow-hidden">
      <div
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${color}`}
      />

      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}
          >
            <span className="text-white text-xl">{icon}</span>
          </div>
          <div>
            <h3 className="text-lg font-bold">{chainName}</h3>
            <Badge variant="neutral" className="text-xs">
              Chain ID: {chainId}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {!userAddress && (
          <div className="text-center py-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center mb-2">
              <span className="text-xl">💼</span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Connect your wallet to use the faucet
            </p>
          </div>
        )}

        {userAddress && !isCorrectChain && (
          <div className="space-y-3">
            <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
              <AlertDescription className="text-orange-700 dark:text-orange-300 text-sm">
                ⚠️ Switch to {chainName} to use this faucet
              </AlertDescription>
            </Alert>
            <Button
              onClick={handleSwitchChain}
              disabled={isSwitchingChain}
              className={`w-full bg-gradient-to-r ${color} hover:opacity-90 text-white`}
            >
              {isSwitchingChain ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Switching...
                </div>
              ) : (
                `Switch to ${chainName}`
              )}
            </Button>
          </div>
        )}

        {userAddress && isCorrectChain && (
          <>
            {/* Current Balance */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Your USDC Balance:
                </span>
                <span className="font-medium">
                  {usdcBalance
                    ? `${formatBalance(usdcBalance)} USDC`
                    : "0.00 USDC"}
                </span>
              </div>
            </div>

            {/* Faucet Amount Input */}
            <div className="space-y-2">
              <Label htmlFor={`amount-${chainId}`}>
                Faucet Amount (Max 10,000 USDC)
              </Label>
              <div className="flex gap-2">
                <Input
                  id={`amount-${chainId}`}
                  type="number"
                  placeholder="1000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  step="1"
                  min="1"
                  max="10000"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="neutral"
                  size="sm"
                  onClick={() => setAmount("10000")}
                  className="px-3"
                >
                  Max
                </Button>
              </div>
            </div>

            {/* Faucet Button */}
            <Button
              onClick={handleFaucet}
              disabled={
                isFaucetInProgress ||
                !amount ||
                parseFloat(amount) <= 0 ||
                parseFloat(amount) > 10000
              }
              className={`w-full bg-gradient-to-r ${color} hover:opacity-90 text-white`}
            >
              {isFaucetInProgress ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Minting USDC...
                </div>
              ) : (
                `🚰 Get ${amount || "0"} USDC`
              )}
            </Button>

            {/* Success Message */}
            {isFaucetSuccess && (
              <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                <AlertDescription className="text-green-700 dark:text-green-300 text-sm">
                  ✅ Successfully minted {amount} USDC! Check your balance.
                </AlertDescription>
              </Alert>
            )}

            {/* Transaction Hash */}
            {lastFaucetHash && (
              <div className="text-xs text-center">
                <span className="text-slate-500">Last faucet TX: </span>
                <a
                  href={getExplorerUrl(lastFaucetHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600 font-mono"
                >
                  {lastFaucetHash.slice(0, 6)}...{lastFaucetHash.slice(-4)}
                </a>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function TokenFaucet() {
  const currentChainId = useChainId();

  // Filter faucets to show only the current chain
  const currentChainFaucets = FAUCET_CHAINS.filter(
    (chain) => chain.id === currentChainId
  );

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Test Token Faucets
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Get free test USDC to experiment with the vaults on{" "}
          {currentChainId === 545
            ? "Flow Testnet"
            : currentChainId === 31
            ? "Rootstock Testnet"
            : "your current network"}
        </p>
      </div>

      {currentChainFaucets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {currentChainFaucets.map((chain) => (
            <ChainFaucet
              key={chain.id}
              chainId={chain.id}
              chainName={chain.name}
              icon={chain.icon}
              color={chain.color}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950 max-w-md mx-auto">
            <AlertDescription className="text-yellow-700 dark:text-yellow-300 text-sm">
              ⚠️ <strong>No faucet available:</strong> Please switch to Flow
              Testnet or Rootstock Testnet to access the token faucets.
            </AlertDescription>
          </Alert>
        </div>
      )}

      <div className="text-center">
        <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 max-w-md mx-auto">
          <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
            💡 <strong>Pro tip:</strong> Use these test tokens to try depositing
            into vaults and see how the AI strategies work!
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
