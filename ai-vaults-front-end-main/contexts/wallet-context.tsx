"use client";

import { createContext, useContext, ReactNode } from "react";
import { useAccount, useBalance, useDisconnect } from "wagmi";

interface WalletContextType {
  // General state
  isConnected: boolean;
  address: string | null;
  balance: string | null;

  // Functions
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  // RainbowKit hooks
  const { address, isConnected } = useAccount();
  const { data: balanceData } = useBalance({ address });
  const { disconnect: rainbowDisconnect } = useDisconnect();

  // Format balance
  const balance = balanceData
    ? `${parseFloat(balanceData.formatted).toFixed(4)} ${balanceData.symbol}`
    : null;

  // Universal disconnect function
  const disconnect = () => {
    rainbowDisconnect();
  };

  const value: WalletContextType = {
    isConnected,
    address: address || null,
    balance,
    disconnect,
  };

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
