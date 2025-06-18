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
import { parseEther, Address, TransactionReceipt } from "viem";
import {
  getVaultFactoryAddressById,
  getTokenAddressById,
  getDefaultAgentAddress,
  getChainConfigById,
} from "@/constants/contracts";
import { insertVault } from "@/lib/supabase";

interface CreateVaultModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

// VaultFactory ABI
const VAULT_FACTORY_ABI = [
  {
    name: "createVaultWithDefaults",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "name", type: "string" },
      { name: "symbol", type: "string" },
    ],
    outputs: [{ name: "vault", type: "address" }],
  },
  {
    name: "createVault",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "asset", type: "address" },
          { name: "name", type: "string" },
          { name: "symbol", type: "string" },
          { name: "manager", type: "address" },
          { name: "agent", type: "address" },
        ],
      },
    ],
    outputs: [{ name: "vault", type: "address" }],
  },
  {
    name: "creationFee",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, name: "vault", type: "address" },
      { indexed: false, name: "asset", type: "address" },
      { indexed: false, name: "name", type: "string" },
      { indexed: false, name: "symbol", type: "string" },
    ],
    name: "VaultCreated",
    type: "event",
  },
] as const;

export function CreateVaultModal({
  isOpen,
  onOpenChange,
}: CreateVaultModalProps) {
  const [vaultName, setVaultName] = useState("");
  const [vaultSymbol, setVaultSymbol] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  const { address: userAddress } = useAccount();
  const currentChainId = useChainId();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();

  const { writeContract, data: createHash } = useWriteContract();

  // Get contract addresses for current chain
  const factoryAddress = getVaultFactoryAddressById(currentChainId);
  const usdcAddress = getTokenAddressById(currentChainId, "MockUSDC");
  const chainInfo = getChainConfigById(currentChainId);
  const agentAddress = getDefaultAgentAddress();

  // Check if current chain is supported
  const isChainSupported = !!factoryAddress && !!usdcAddress;

  // Read creation fee
  const { data: creationFee } = useReadContract({
    address: factoryAddress as Address,
    abi: VAULT_FACTORY_ABI,
    functionName: "creationFee",
    query: { enabled: !!factoryAddress },
  });

  // Wait for transaction receipt
  const {
    isLoading: isConfirming,
    isSuccess,
    isError,
    data: receipt,
  } = useWaitForTransactionReceipt({
    hash: createHash,
  });

  useEffect(() => {
    if (isSuccess && createHash && receipt) {
      setTxHash(createHash);
      setIsCreating(false);

      // Extract vault address from transaction logs
      handleVaultCreationSuccess(receipt);

      // Reset form
      setVaultName("");
      setVaultSymbol("");
      // Close modal after a short delay
      setTimeout(() => {
        onOpenChange(false);
        setTxHash(null);
      }, 3000);
    }
  }, [isSuccess, createHash, receipt, onOpenChange]);

  const handleVaultCreationSuccess = async (receipt: TransactionReceipt) => {
    try {
      console.log("Processing vault creation success...");
      console.log("Transaction receipt:", receipt);

      // Simplified approach: look for VaultCreated event or new contract deployments
      const logs = receipt.logs;

      if (logs && logs.length > 0) {
        console.log("Found", logs.length, "logs in transaction");

        let vaultAddress = null;

        // Look for the VaultCreated event or any new contract deployment
        for (let i = 0; i < logs.length; i++) {
          const log = logs[i];
          console.log(`Log ${i}:`, {
            address: log.address,
            topics: log.topics?.map((t) => t.slice(0, 10) + "..."), // Truncate for readability
            data: log.data?.slice(0, 20) + "...",
          });

          // If the log is from a different address than the factory, it's likely the vault
          if (
            log.address &&
            log.address.toLowerCase() !== factoryAddress?.toLowerCase()
          ) {
            vaultAddress = log.address;
            console.log("Found vault address from log:", vaultAddress);
            break;
          }
        }

        // Alternative: use the last non-factory address in logs
        if (!vaultAddress) {
          for (let i = logs.length - 1; i >= 0; i--) {
            const log = logs[i];
            if (
              log.address &&
              log.address.toLowerCase() !== factoryAddress?.toLowerCase()
            ) {
              vaultAddress = log.address;
              console.log(
                "Found vault address from reverse search:",
                vaultAddress
              );
              break;
            }
          }
        }

        if (vaultAddress) {
          console.log("Final vault address to save:", vaultAddress);
          await saveVaultToSupabase(vaultAddress);
        } else {
          console.warn("Could not extract vault address from transaction logs");
          // Let's try a timeout approach - poll for new vaults
          setTimeout(() => {
            console.log("Attempting to save vault with placeholder address...");
            // Save with transaction hash as fallback
            saveVaultToSupabase(createHash || "pending");
          }, 2000);
        }
      } else {
        console.warn("No logs found in transaction receipt");
      }
    } catch (error) {
      console.error("Error handling vault creation success:", error);
    }
  };

  const saveVaultToSupabase = async (vaultAddress: string) => {
    try {
      console.log("Saving vault to Supabase...");
      const chainInfo = getChainConfigById(currentChainId);
      const blockchainName = chainInfo?.name || "Unknown";

      const vaultData = {
        vaultaddress: vaultAddress.toLowerCase(),
        blockchain: blockchainName,
        nombre: vaultName,
        symbol: vaultSymbol,
      };

      console.log("Vault data to insert:", vaultData);
      const result = await insertVault(vaultData);
      console.log("Vault saved to Supabase successfully:", result);
    } catch (error) {
      console.error("Error saving vault to Supabase:", error);
      // Don't throw here to avoid disrupting the user experience
    }
  };

  useEffect(() => {
    if (isError) {
      setIsCreating(false);
    }
  }, [isError]);

  // Auto-generate symbol from name
  useEffect(() => {
    if (vaultName && !vaultSymbol) {
      const symbol = vaultName
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase())
        .join("")
        .slice(0, 6);
      setVaultSymbol(symbol);
    }
  }, [vaultName, vaultSymbol]);

  const handleSwitchChain = async () => {
    try {
      // Switch to Flow Testnet if available, otherwise Rootstock Testnet
      const targetChainId = factoryAddress ? currentChainId : 545; // Flow Testnet
      await switchChain({ chainId: targetChainId });
    } catch (error) {
      console.error("Failed to switch chain:", error);
    }
  };

  const handleCreateVault = async () => {
    if (
      !factoryAddress ||
      !usdcAddress ||
      !userAddress ||
      !vaultName ||
      !vaultSymbol
    ) {
      return;
    }

    setIsCreating(true);

    try {
      // Use simple creation with defaults
      await writeContract({
        address: factoryAddress as Address,
        abi: VAULT_FACTORY_ABI,
        functionName: "createVaultWithDefaults",
        args: [usdcAddress as Address, vaultName, vaultSymbol],
        value: creationFee || parseEther("0"),
      });
    } catch (error) {
      console.error("Failed to create vault:", error);
      setIsCreating(false);
    }
  };

  const isFormValid = vaultName.trim() && vaultSymbol.trim();
  const shouldShowChainWarning = !isChainSupported;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🏭 Create New Vault
          </DialogTitle>
          <DialogDescription>
            Deploy a new AI-managed vault on{" "}
            {chainInfo?.name || "the current network"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Chain Warning */}
          {shouldShowChainWarning && (
            <Alert>
              <AlertDescription className="text-sm">
                <div className="space-y-2">
                  <p>VaultFactory is not available on this network.</p>
                  <p>Supported networks:</p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="neutral">Flow Testnet</Badge>
                    <Badge variant="neutral">Rootstock Testnet</Badge>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleSwitchChain}
                    disabled={isSwitchingChain}
                  >
                    {isSwitchingChain ? "Switching..." : "Switch Network"}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Success Message */}
          {isSuccess && txHash && (
            <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
              <AlertDescription className="text-sm text-green-800 dark:text-green-200">
                ✅ Vault created successfully! Transaction:{" "}
                {txHash.slice(0, 10)}...
              </AlertDescription>
            </Alert>
          )}

          {/* Error Message */}
          {isError && (
            <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
              <AlertDescription className="text-sm text-red-800 dark:text-red-200">
                ❌ Failed to create vault. Please try again.
              </AlertDescription>
            </Alert>
          )}

          {/* Form Fields */}
          {isChainSupported && (
            <>
              <div className="space-y-2">
                <Label htmlFor="vault-name">Vault Name</Label>
                <Input
                  id="vault-name"
                  placeholder="e.g., AI Trading Strategy"
                  value={vaultName}
                  onChange={(e) => setVaultName(e.target.value)}
                  disabled={isCreating || isConfirming}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vault-symbol">Vault Symbol</Label>
                <Input
                  id="vault-symbol"
                  placeholder="e.g., ATS"
                  value={vaultSymbol}
                  onChange={(e) => setVaultSymbol(e.target.value.toUpperCase())}
                  disabled={isCreating || isConfirming}
                  maxLength={10}
                />
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Max 10 characters. Will be auto-generated from name if empty.
                </p>
              </div>

              {/* Vault Configuration */}
              <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <h4 className="text-sm font-medium">Vault Configuration</h4>
                <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>Asset:</span>
                    <span className="font-mono">USDC</span>
                  </div>
                  <div className="flex justify-between">
                    <span>AI Agent:</span>
                    <span className="font-mono">
                      {agentAddress.slice(0, 6)}...{agentAddress.slice(-4)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Manager:</span>
                    <span>
                      You ({userAddress?.slice(0, 6)}...{userAddress?.slice(-4)}
                      )
                    </span>
                  </div>
                  {creationFee && (
                    <div className="flex justify-between">
                      <span>Creation Fee:</span>
                      <span>
                        {(Number(creationFee) / 1e18).toFixed(4)}{" "}
                        {currentChainId === 545 ? "FLOW" : "RBTC"}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Create Button */}
              <Button
                onClick={handleCreateVault}
                disabled={
                  !isFormValid || isCreating || isConfirming || !userAddress
                }
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                {isCreating || isConfirming ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    {isConfirming ? "Confirming..." : "Creating Vault..."}
                  </>
                ) : (
                  "🚀 Create Vault"
                )}
              </Button>

              {!userAddress && (
                <p className="text-xs text-slate-600 dark:text-slate-400 text-center">
                  Please connect your wallet to create a vault
                </p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
