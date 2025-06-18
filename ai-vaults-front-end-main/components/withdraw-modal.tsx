"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
  useSwitchChain,
} from "wagmi";
import { parseUnits, formatUnits, Address } from "viem";

interface VaultData {
  id: string;
  name: string;
  blockchain: string;
  chainId: number;
  contractAddress: string;
  supportedTokens: string[];
}

interface WithdrawModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  vault: VaultData | null;
}

// ERC4626 Vault ABI for withdrawal
const VAULT_ABI = [
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    name: "previewWithdraw",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "maxWithdraw",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export function WithdrawModal({
  isOpen,
  onOpenChange,
  vault,
}: WithdrawModalProps) {
  const [amount, setAmount] = useState<string>("");

  const { address: userAddress } = useAccount();
  const currentChainId = useChainId();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();

  const {
    writeContract: writeWithdraw,
    data: withdrawHash,
    isPending: isWithdrawPending,
  } = useWriteContract();

  // Get user's vault shares balance
  const { data: sharesBalance } = useReadContract({
    address: vault?.contractAddress as Address,
    abi: VAULT_ABI,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!vault && !!userAddress },
  });

  // Get max withdrawable amount
  const { data: maxWithdrawAmount } = useReadContract({
    address: vault?.contractAddress as Address,
    abi: VAULT_ABI,
    functionName: "maxWithdraw",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!vault && !!userAddress },
  });

  // Parse amount (assuming USDC with 6 decimals for withdrawal)
  const parsedAmount = amount ? parseUnits(amount, 6) : BigInt(0);

  // Preview shares needed for withdrawal
  const { data: sharesNeeded } = useReadContract({
    address: vault?.contractAddress as Address,
    abi: VAULT_ABI,
    functionName: "previewWithdraw",
    args: parsedAmount > BigInt(0) ? [parsedAmount] : undefined,
    query: { enabled: parsedAmount > BigInt(0) && !!vault },
  });

  // Wait for withdrawal transaction confirmation
  const { isLoading: isWithdrawConfirming, isSuccess: isWithdrawSuccess } =
    useWaitForTransactionReceipt({
      hash: withdrawHash,
    });

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setAmount("");
    }
  }, [isOpen]);

  // Close modal on successful withdrawal
  useEffect(() => {
    if (isWithdrawSuccess) {
      setTimeout(() => {
        onOpenChange(false);
      }, 2000);
    }
  }, [isWithdrawSuccess, onOpenChange]);

  const handleWithdraw = async () => {
    if (!vault || !userAddress || parsedAmount === BigInt(0)) return;

    try {
      writeWithdraw({
        address: vault.contractAddress as Address,
        abi: VAULT_ABI,
        functionName: "withdraw",
        args: [parsedAmount, userAddress, userAddress],
      });
    } catch (error) {
      console.error("Withdrawal failed:", error);
    }
  };

  const formatBalance = (balance: bigint, decimals: number) => {
    return parseFloat(formatUnits(balance, decimals)).toFixed(4);
  };

  const isFormValid = amount && parseFloat(amount) > 0 && userAddress;
  const hasInsufficientShares =
    sharesNeeded && sharesBalance && sharesNeeded > sharesBalance;
  const exceedsMaxWithdraw =
    maxWithdrawAmount && parsedAmount > maxWithdrawAmount;

  // Chain verification
  const isCorrectChain = currentChainId === vault?.chainId;
  const needsChainSwitch = vault && !isCorrectChain;

  const isWithdrawInProgress = isWithdrawPending || isWithdrawConfirming;

  const handleSwitchChain = async () => {
    if (!vault) return;
    try {
      await switchChain({ chainId: vault.chainId });
    } catch (error) {
      console.error("Failed to switch chain:", error);
    }
  };

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

  if (!vault) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 justify-center">
            <div
              className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getBlockchainColor(
                vault.blockchain
              )} flex items-center justify-center`}
            >
              <span className="text-white font-bold text-sm">
                {vault.blockchain === "Flow Testnet" ? "🌊" : "₿"}
              </span>
            </div>
            <DialogTitle className="text-xl font-bold text-center">
              Withdraw from {vault.name}
            </DialogTitle>
          </div>
          <DialogDescription className="text-center text-slate-600 dark:text-slate-400">
            Withdraw your deposited funds from the vault
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Wallet Connection Check */}
          {!userAddress && (
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 p-6 text-center">
              <div className="absolute inset-0 bg-blue-500/5"></div>
              <div className="relative">
                <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-3">
                  <span className="text-xl">💼</span>
                </div>
                <h3 className="font-semibold text-blue-700 dark:text-blue-300 mb-1">
                  Connect Your Wallet
                </h3>
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  Please connect your wallet to withdraw from this vault
                </p>
              </div>
            </div>
          )}

          {/* Chain Switch Warning */}
          {userAddress && needsChainSwitch && (
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-950 p-6">
              <div className="absolute inset-0 bg-orange-500/5"></div>
              <div className="relative space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
                    <span className="text-xl">⚠️</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-orange-700 dark:text-orange-300">
                      Wrong Network Detected
                    </h3>
                    <p className="text-sm text-orange-600 dark:text-orange-400">
                      Switch to {vault.blockchain} (Chain ID: {vault.chainId})
                    </p>
                  </div>
                </div>

                <Button
                  onClick={handleSwitchChain}
                  disabled={isSwitchingChain}
                  className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white"
                >
                  {isSwitchingChain ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Switching to {vault.blockchain}...
                    </div>
                  ) : (
                    `Switch to ${vault.blockchain}`
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Only show form if wallet connected and on correct chain */}
          {userAddress && isCorrectChain && (
            <>
              {/* Balance Info */}
              <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <h4 className="font-medium text-slate-900 dark:text-white">
                  Your Vault Position
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">
                      Vault Shares:
                    </span>
                    <span className="font-medium">
                      {sharesBalance
                        ? formatBalance(sharesBalance, 18)
                        : "0.0000"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">
                      Max Withdrawable:
                    </span>
                    <span className="font-medium">
                      {maxWithdrawAmount
                        ? `$${formatBalance(maxWithdrawAmount, 6)}`
                        : "$0.00"}{" "}
                      USDC
                    </span>
                  </div>
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="amount">Withdrawal Amount (USDC)</Label>
                  {maxWithdrawAmount && (
                    <Button
                      type="button"
                      variant="neutral"
                      size="sm"
                      className="h-auto p-1 text-xs"
                      onClick={() =>
                        setAmount(formatBalance(maxWithdrawAmount, 6))
                      }
                    >
                      Max
                    </Button>
                  )}
                </div>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  step="any"
                  min="0"
                />

                {hasInsufficientShares && (
                  <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                    <AlertDescription className="text-red-700 dark:text-red-300 text-sm">
                      Insufficient vault shares for this withdrawal amount
                    </AlertDescription>
                  </Alert>
                )}

                {exceedsMaxWithdraw && (
                  <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                    <AlertDescription className="text-red-700 dark:text-red-300 text-sm">
                      Amount exceeds maximum withdrawable: $
                      {maxWithdrawAmount
                        ? formatBalance(maxWithdrawAmount, 6)
                        : "0"}{" "}
                      USDC
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Preview */}
              {sharesNeeded && (
                <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <h4 className="font-medium text-slate-900 dark:text-white">
                    Preview
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">
                        Withdrawal Amount:
                      </span>
                      <span className="font-medium">${amount} USDC</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">
                        Shares to Burn:
                      </span>
                      <span className="font-medium">
                        {formatBalance(sharesNeeded, 18)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Withdraw Button */}
              <Button
                onClick={handleWithdraw}
                disabled={
                  !isFormValid ||
                  hasInsufficientShares ||
                  exceedsMaxWithdraw ||
                  isWithdrawInProgress
                }
                className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700"
              >
                {isWithdrawInProgress ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Withdrawing...
                  </div>
                ) : (
                  "Withdraw"
                )}
              </Button>

              {/* Success Message */}
              {isWithdrawSuccess && (
                <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                  <AlertDescription className="text-green-700 dark:text-green-300 text-sm">
                    ✅ Withdrawal successful! Your funds have been transferred
                    to your wallet.
                  </AlertDescription>
                </Alert>
              )}

              {/* Transaction Info */}
              <div className="space-y-2">
                <div className="text-xs text-center text-slate-500 dark:text-slate-400">
                  Withdrawing on {vault.blockchain} (Chain ID: {vault.chainId})
                </div>

                {withdrawHash && (
                  <div className="text-xs text-center">
                    <span className="text-slate-500">Transaction: </span>
                    <a
                      href={`https://${
                        vault.chainId === 31
                          ? "explorer.testnet.rsk.co"
                          : "evm-testnet.flowscan.io"
                      }/tx/${withdrawHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600 font-mono"
                    >
                      {withdrawHash.slice(0, 6)}...{withdrawHash.slice(-4)}
                    </a>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
