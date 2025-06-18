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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

interface WalletConnectModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onWalletConnected?: () => void;
}

export function WalletConnectModal({
  isOpen,
  onOpenChange,
  onWalletConnected,
}: WalletConnectModalProps) {
  const [waitingForRainbowKit, setWaitingForRainbowKit] = useState(false);

  const { openConnectModal } = useConnectModal();
  const { isConnected: rainbowConnected } = useAccount();

  // Detect when RainbowKit connects after opening the modal
  useEffect(() => {
    if (waitingForRainbowKit && rainbowConnected) {
      setWaitingForRainbowKit(false);
      onWalletConnected?.();
      onOpenChange(false);
    }
  }, [rainbowConnected, waitingForRainbowKit, onWalletConnected, onOpenChange]);

  const handleRainbowKitConnect = () => {
    // Close the modal immediately
    onOpenChange(false);
    setWaitingForRainbowKit(true);

    // Open RainbowKit modal after a small delay
    setTimeout(() => {
      openConnectModal?.();
    }, 100);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-bold">
            Connect Your Wallet
          </DialogTitle>
          <DialogDescription className="text-center text-slate-600 dark:text-slate-400">
            Connect your wallet to access DEFAI
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* RainbowKit Option */}
          <Card className="transition-all hover:shadow-md hover:border-purple-300 dark:hover:border-purple-600">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">🌈</span>
                </div>
                <div>
                  <CardTitle className="text-base">MetaMask & More</CardTitle>
                  <CardDescription className="text-sm">
                    Connect with your browser wallet
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Button
                onClick={handleRainbowKitConnect}
                disabled={waitingForRainbowKit}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                {waitingForRainbowKit ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Opening Wallet...
                  </div>
                ) : (
                  "Connect Wallet"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-xs text-center text-slate-500 dark:text-slate-400 mt-4">
          By connecting a wallet, you agree to DEFAI&apos;s Terms of Service
        </div>
      </DialogContent>
    </Dialog>
  );
}
