"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DepositSuccessProps {
  isOpen: boolean;
  onClose: () => void;
  depositData: {
    tokenName: string;
    amount: string;
    usdValue: string;
    vaultName: string;
    blockchain: string;
    txHash: string;
    chainId: number;
  } | null;
}

export function DepositSuccess({
  isOpen,
  onClose,
  depositData,
}: DepositSuccessProps) {
  const [showContent, setShowContent] = useState(false);
  const [animationStep, setAnimationStep] = useState(0);

  useEffect(() => {
    if (isOpen && depositData) {
      // Stagger animations for a smooth reveal
      setTimeout(() => setShowContent(true), 100);
      setTimeout(() => setAnimationStep(1), 300);
      setTimeout(() => setAnimationStep(2), 600);
      setTimeout(() => setAnimationStep(3), 900);
    } else {
      setShowContent(false);
      setAnimationStep(0);
    }
  }, [isOpen, depositData]);

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

  const getExplorerUrl = (chainId: number, txHash: string) => {
    return chainId === 31
      ? `https://explorer.testnet.rsk.co/tx/${txHash}`
      : `https://evm-testnet.flowscan.io/tx/${txHash}`;
  };

  if (!isOpen || !depositData) return null;

  // Render the modal using a portal to ensure it appears at the document root
  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative max-w-md w-full mx-4 z-[100000]">
        {/* Success Card */}
        <Card
          className={`relative overflow-hidden transform transition-all duration-700 ${
            showContent ? "scale-100 opacity-100" : "scale-95 opacity-0"
          }`}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 dark:from-emerald-950 dark:via-green-950 dark:to-teal-950" />

          {/* Animated background particles */}
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className={`absolute w-2 h-2 bg-emerald-400 rounded-full opacity-20 transition-all duration-1000 ${
                  animationStep >= 2 ? "animate-bounce" : ""
                }`}
                style={{
                  left: `${20 + i * 15}%`,
                  top: `${10 + i * 10}%`,
                  animationDelay: `${i * 100}ms`,
                }}
              />
            ))}
          </div>

          <CardContent className="relative p-8 text-center">
            {/* Success Icon */}
            <div
              className={`mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mb-6 transform transition-all duration-700 ${
                animationStep >= 1 ? "scale-100 rotate-0" : "scale-0 rotate-180"
              }`}
            >
              <div
                className={`text-4xl transition-all duration-500 ${
                  animationStep >= 1 ? "opacity-100" : "opacity-0"
                }`}
              >
                ✨
              </div>
            </div>

            {/* Success Message */}
            <div
              className={`space-y-4 transition-all duration-700 delay-300 ${
                animationStep >= 2
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              }`}
            >
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Deposit Successful!
              </h2>
              <p className="text-slate-600 dark:text-slate-400">
                Your funds have been successfully deposited into the vault
              </p>
            </div>

            {/* Deposit Details */}
            <div
              className={`mt-8 space-y-4 transition-all duration-700 delay-500 ${
                animationStep >= 3
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              }`}
            >
              {/* Amount deposited */}
              <div className="bg-white/60 dark:bg-slate-800/60 rounded-xl p-4 backdrop-blur-sm">
                <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                  Amount Deposited
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {depositData.amount} {depositData.tokenName}
                </div>
                <div className="text-lg text-emerald-600 dark:text-emerald-400 font-medium">
                  ≈ {depositData.usdValue}
                </div>
              </div>

              {/* Vault info */}
              <div className="flex items-center justify-between p-4 bg-white/40 dark:bg-slate-800/40 rounded-xl backdrop-blur-sm">
                <div className="text-left">
                  <div className="font-medium text-slate-900 dark:text-white">
                    {depositData.vaultName}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    Vault
                  </div>
                </div>
                <Badge
                  className={`bg-gradient-to-r ${getBlockchainColor(
                    depositData.blockchain
                  )} text-white border-0`}
                >
                  {depositData.blockchain}
                </Badge>
              </div>

              {/* Transaction hash */}
              <div className="text-center">
                <a
                  href={getExplorerUrl(depositData.chainId, depositData.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  <span>View Transaction</span>
                  <span className="font-mono">
                    {depositData.txHash.slice(0, 6)}...
                    {depositData.txHash.slice(-4)}
                  </span>
                  <span>↗</span>
                </a>
              </div>
            </div>

            {/* Action Buttons */}
            <div
              className={`mt-8 space-y-3 transition-all duration-700 delay-700 ${
                animationStep >= 3
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              }`}
            >
              <Button
                onClick={onClose}
                className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-medium"
              >
                Continue Trading
              </Button>
              <Button
                variant="neutral"
                size="sm"
                className="w-full text-slate-600 dark:text-slate-400"
                onClick={() => {
                  // Navigate to portfolio or positions view
                  onClose();
                }}
              >
                View Portfolio
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Floating particles effect */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className={`absolute w-1 h-1 bg-emerald-400 rounded-full transition-all duration-2000 ${
                animationStep >= 2 ? "opacity-0 -translate-y-20" : "opacity-60"
              }`}
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${i * 150}ms`,
              }}
            />
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
