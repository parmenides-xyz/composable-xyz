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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  getTokenAddress,
  getTokenConfig,
  TokenName,
} from "@/constants/contracts";
import { DepositSuccess } from "./deposit-success";

interface VaultData {
  id: string;
  name: string;
  blockchain: string;
  chainId: number;
  contractAddress: string;
  supportedTokens: string[];
}

interface DepositModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  vault: VaultData | null;
  goToFaucet: () => void;
}

// ERC20 ABI for token operations
const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// MultiTokenVault ABI (partial) - Standard ERC4626
const VAULT_ABI = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    name: "previewDeposit",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ name: "shares", type: "uint256" }],
  },
] as const;

export function DepositModal({
  isOpen,
  onOpenChange,
  vault,
  goToFaucet,
}: DepositModalProps) {
  const [selectedToken, setSelectedToken] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [needsApproval, setNeedsApproval] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [depositData, setDepositData] = useState<{
    tokenName: string;
    amount: string;
    usdValue: string;
    vaultName: string;
    blockchain: string;
    txHash: string;
    chainId: number;
  } | null>(null);

  const { address: userAddress } = useAccount();
  const currentChainId = useChainId();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();

  // Separate hooks for approval and deposit transactions
  const {
    writeContract: writeApproval,
    data: approvalHash,
    isPending: isApprovalPending,
  } = useWriteContract();

  const {
    writeContract: writeDeposit,
    data: depositHash,
    isPending: isDepositPending,
  } = useWriteContract();

  // Get allowed tokens for this vault
  const getAllowedTokens = () => {
    // All vaults now only support USDC
    return ["MockUSDC"];
  };

  const allowedTokens = vault ? getAllowedTokens() : [];

  // Helper function to map blockchain names to contract chain names
  const getBlockchainName = (blockchain: string | undefined) => {
    if (!blockchain) return "flowTestnet";

    const lowerBlockchain = blockchain.toLowerCase();

    if (lowerBlockchain.includes("flow")) {
      return "flowTestnet";
    } else if (lowerBlockchain.includes("rootstock")) {
      return "rootstockTestnet";
    } else {
      // Default to flowTestnet
      return "flowTestnet";
    }
  };

  // Get token addresses
  const selectedTokenAddress = selectedToken
    ? getTokenAddress(
        getBlockchainName(vault?.blockchain),
        selectedToken as TokenName
      )
    : null;

  const selectedTokenConfig = selectedToken
    ? getTokenConfig(selectedToken as TokenName)
    : null;

  // Parse amount based on token decimals
  const parsedAmount =
    selectedTokenConfig && amount
      ? parseUnits(amount, selectedTokenConfig.decimals)
      : BigInt(0);

  // Read user's token balance
  const { data: tokenBalance } = useReadContract({
    address: selectedTokenAddress as Address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!selectedTokenAddress && !!userAddress },
  });

  // Read current allowance
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract(
    {
      address: selectedTokenAddress as Address,
      abi: ERC20_ABI,
      functionName: "allowance",
      args:
        userAddress && vault
          ? [userAddress, vault.contractAddress as Address]
          : undefined,
      query: { enabled: !!selectedTokenAddress && !!userAddress && !!vault },
    }
  );

  // Preview shares directly from the amount (since we're depositing the token directly)
  const { data: expectedShares } = useReadContract({
    address: vault?.contractAddress as Address,
    abi: VAULT_ABI,
    functionName: "previewDeposit",
    args: parsedAmount > BigInt(0) ? [parsedAmount] : undefined,
    query: { enabled: parsedAmount > BigInt(0) && !!vault },
  });

  // Wait for approval transaction confirmation
  const { isLoading: isApprovalConfirming, isSuccess: isApprovalSuccess } =
    useWaitForTransactionReceipt({
      hash: approvalHash,
    });

  // Wait for deposit transaction confirmation
  const { isLoading: isDepositConfirming, isSuccess: isDepositSuccess } =
    useWaitForTransactionReceipt({
      hash: depositHash,
    });

  // Check if approval is needed
  useEffect(() => {
    if (currentAllowance !== undefined && parsedAmount > BigInt(0)) {
      setNeedsApproval(currentAllowance < parsedAmount);
    } else {
      setNeedsApproval(false);
    }
  }, [currentAllowance, parsedAmount]);

  // Refetch allowance after successful approval
  useEffect(() => {
    if (isApprovalSuccess) {
      // Immediate refetch
      refetchAllowance();

      // Additional refetch after a short delay to ensure blockchain state is updated
      const timeout = setTimeout(() => {
        refetchAllowance();
      }, 2000);

      return () => clearTimeout(timeout);
    }
  }, [isApprovalSuccess, refetchAllowance]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedToken("");
      setAmount("");
      setNeedsApproval(false);
    }
  }, [isOpen]);

  const formatBalance = (balance: bigint, decimals: number) => {
    return parseFloat(formatUnits(balance, decimals)).toFixed(4);
  };

  // Calculate approximate USD value based on token
  const getApproximateUSDValue = (tokenName: string, amount: string) => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return "$0.00";

    // Simple price approximations for demo
    switch (tokenName) {
      case "MockUSDC":
        return `$${numAmount.toFixed(2)}`;
      case "MockWBTC":
        return `$${(numAmount * 45000).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
      case "MockWETH":
        return `$${(numAmount * 2500).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
      default:
        return `$${numAmount.toFixed(2)}`;
    }
  };

  // Close modal on successful deposit and show success screen
  useEffect(() => {
    if (isDepositSuccess && depositHash && vault) {
      // Prepare success data
      const successData = {
        tokenName: selectedToken,
        amount: amount,
        usdValue: getApproximateUSDValue(selectedToken, amount),
        vaultName: vault.name,
        blockchain: vault.blockchain,
        txHash: depositHash,
        chainId: vault.chainId,
      };

      setDepositData(successData);

      // Small delay to show success state before showing success modal
      setTimeout(() => {
        onOpenChange(false);
        setShowSuccess(true);
      }, 1000);
    }
  }, [
    isDepositSuccess,
    depositHash,
    vault,
    selectedToken,
    amount,
    expectedShares,
    onOpenChange,
  ]);

  const handleApprove = async () => {
    if (!selectedTokenAddress || !vault || parsedAmount === BigInt(0)) return;

    try {
      writeApproval({
        address: selectedTokenAddress as Address,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [vault.contractAddress as Address, parsedAmount],
      });
    } catch (error) {
      console.error("Approval failed:", error);
    }
  };

  const handleDeposit = async () => {
    if (
      !vault ||
      !selectedTokenAddress ||
      !userAddress ||
      parsedAmount === BigInt(0)
    )
      return;

    try {
      // Always use standard ERC4626 deposit function for all tokens
      writeDeposit({
        address: vault.contractAddress as Address,
        abi: VAULT_ABI,
        functionName: "deposit",
        args: [parsedAmount, userAddress],
      });
    } catch (error) {
      console.error("Deposit failed:", error);
    }
  };

  const isFormValid =
    selectedToken && amount && parseFloat(amount) > 0 && userAddress;
  const hasInsufficientBalance = tokenBalance && parsedAmount > tokenBalance;

  // Chain verification
  const isCorrectChain = currentChainId === vault?.chainId;
  const needsChainSwitch = vault && !isCorrectChain;

  // Button states
  // ALL tokens need approval before deposit - no exceptions
  const isApprovalNeeded = true; // Always require approval for any token
  const actuallyNeedsApproval = needsApproval && isApprovalNeeded;
  const isApprovalInProgress = isApprovalPending || isApprovalConfirming;
  const isDepositInProgress = isDepositPending || isDepositConfirming;

  // Approval flow: force approval first for ALL tokens
  const showApprovalButton =
    actuallyNeedsApproval &&
    isFormValid &&
    !hasInsufficientBalance &&
    isCorrectChain;
  const showDepositButton =
    !actuallyNeedsApproval &&
    isFormValid &&
    !hasInsufficientBalance &&
    isCorrectChain;

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
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3 justify-center">
              <div
                className={`w-8 h-8 rounded-lg bg-gradient-to-br ${
                  vault
                    ? getBlockchainColor(vault.blockchain)
                    : "from-gray-500 to-gray-600"
                } flex items-center justify-center`}
              >
                <span className="text-white font-bold text-sm">
                  {vault?.blockchain === "Flow Testnet" ? "🌊" : "₿"}
                </span>
              </div>
              <DialogTitle className="text-xl font-bold text-center">
                Deposit to {vault?.name}
              </DialogTitle>
            </div>
            <DialogDescription className="text-center text-slate-600 dark:text-slate-400">
              Deposit tokens into your AI-powered vault for automated yield
              optimization
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
                    Please connect your wallet to deposit into this vault
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
                {/* Token Selection */}
                <div className="space-y-3">
                  <Label htmlFor="token" className="text-base font-medium">
                    Select Token
                  </Label>
                  <Select
                    value={selectedToken}
                    onValueChange={setSelectedToken}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Choose a token to deposit" />
                    </SelectTrigger>
                    <SelectContent>
                      {allowedTokens.map((token) => {
                        const config = getTokenConfig(token as TokenName);
                        return (
                          <SelectItem key={token} value={token}>
                            <div className="flex items-center justify-between w-full">
                              <span className="font-medium">{token}</span>
                              {config && (
                                <Badge
                                  variant="neutral"
                                  className="ml-2 text-xs"
                                >
                                  {config.decimals} decimals
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Amount Input */}
                {selectedToken && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="amount">Amount</Label>
                      {tokenBalance && selectedTokenConfig && (
                        <div className="text-right">
                          <div className="text-sm text-slate-500">
                            Balance:{" "}
                            {formatBalance(
                              tokenBalance,
                              selectedTokenConfig.decimals
                            )}{" "}
                            {selectedToken}
                          </div>
                          <Button
                            type="button"
                            variant="neutral"
                            size="sm"
                            className="h-auto p-1 text-xs"
                            onClick={() =>
                              setAmount(
                                formatBalance(
                                  tokenBalance,
                                  selectedTokenConfig.decimals
                                )
                              )
                            }
                          >
                            Max
                          </Button>
                        </div>
                      )}
                    </div>
                    <Input
                      disabled={tokenBalance === BigInt(0)}
                      id="amount"
                      type="number"
                      placeholder="0.0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      step="any"
                      min="0"
                    />

                    {tokenBalance === BigInt(0) && (
                      <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                        <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
                          You don&apos;t have enough tokens to complete this
                          transaction. We recommend visiting the faucet to get
                          more tokens and proceed. To do so, simply click the
                          button below.
                          <div className="mt-4 flex justify-center">
                            <Button
                              onClick={() => {
                                // Go to faucet
                                goToFaucet();
                              }}
                              variant="default"
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              Go to Faucet
                            </Button>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}

                    {hasInsufficientBalance && (
                      <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                        <AlertDescription className="text-red-700 dark:text-red-300 text-sm">
                          Insufficient balance. You have{" "}
                          {tokenBalance && selectedTokenConfig
                            ? formatBalance(
                                tokenBalance,
                                selectedTokenConfig.decimals
                              )
                            : "0"}{" "}
                          {selectedToken}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                {/* Preview */}
                {expectedShares && selectedTokenConfig && (
                  <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <h4 className="font-medium text-slate-900 dark:text-white">
                      Preview
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">
                          Deposit Amount:
                        </span>
                        <span className="font-medium">
                          {amount} {selectedToken}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">
                          Est. USD Value:
                        </span>
                        <span className="font-medium">
                          {getApproximateUSDValue(selectedToken, amount)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">
                          Vault Shares:
                        </span>
                        <span className="font-medium">
                          {formatBalance(expectedShares, 18)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-3">
                  {/* Step 1: Approval (required for ALL tokens) */}
                  {showApprovalButton && (
                    <div className="space-y-2">
                      <div className="text-sm text-slate-600 dark:text-slate-400 text-center">
                        Step 1: Approve {selectedToken} for vault access
                        <div className="text-xs text-slate-500 mt-1">
                          (Required for all tokens)
                        </div>
                      </div>
                      <Button
                        onClick={handleApprove}
                        disabled={isApprovalInProgress}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                      >
                        {isApprovalInProgress ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Approving {selectedToken}...
                          </div>
                        ) : (
                          `Approve ${selectedToken}`
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Step 2: Deposit (only available after approval) */}
                  {showDepositButton && (
                    <div className="space-y-2">
                      <div className="text-sm text-green-600 dark:text-green-400 text-center">
                        ✅ {selectedToken} approved! Step 2: Deposit to vault
                      </div>
                      <Button
                        onClick={handleDeposit}
                        disabled={isDepositInProgress}
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                      >
                        {isDepositInProgress ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Depositing...
                          </div>
                        ) : (
                          "Deposit"
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Waiting for approval message */}
                  {actuallyNeedsApproval && !showApprovalButton && (
                    <div className="text-center text-sm text-slate-500 dark:text-slate-400 py-4">
                      Please complete the form above to proceed with approval
                    </div>
                  )}
                </div>

                {/* Chain Info and Transaction Status */}
                <div className="space-y-2">
                  <div className="text-xs text-center text-slate-500 dark:text-slate-400">
                    Depositing on {vault.blockchain} (Chain ID: {vault.chainId})
                  </div>

                  {/* Transaction Hashes */}
                  {approvalHash && (
                    <div className="text-xs text-center">
                      <span className="text-slate-500">Approval TX: </span>
                      <a
                        href={`https://${
                          vault.chainId === 31
                            ? "explorer.testnet.rsk.co"
                            : "evm-testnet.flowscan.io"
                        }/tx/${approvalHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-600 font-mono"
                      >
                        {approvalHash.slice(0, 6)}...{approvalHash.slice(-4)}
                      </a>
                    </div>
                  )}

                  {depositHash && (
                    <div className="text-xs text-center">
                      <span className="text-slate-500">Deposit TX: </span>
                      <a
                        href={`https://${
                          vault.chainId === 31
                            ? "explorer.testnet.rsk.co"
                            : "evm-testnet.flowscan.io"
                        }/tx/${depositHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-600 font-mono"
                      >
                        {depositHash.slice(0, 6)}...{depositHash.slice(-4)}
                      </a>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {showSuccess && depositData && (
        <DepositSuccess
          isOpen={showSuccess}
          onClose={() => {
            setShowSuccess(false);
            setDepositData(null);
          }}
          depositData={depositData}
        />
      )}
    </>
  );
}
