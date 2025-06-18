import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { mainnet } from "viem/chains";

// Story Protocol mainnet chain configuration
const storyProtocol = {
  id: 1514,
  name: "Story Protocol",
  nativeCurrency: {
    decimals: 18,
    name: "IP Token",
    symbol: "IP",
  },
  rpcUrls: {
    default: {
      http: ["https://mainnet.storyrpc.io"],
    },
  },
  blockExplorers: {
    default: {
      name: "StoryScan",
      url: "https://storyscan.io",
    },
  },
} as const;

export const config = createConfig({
  chains: [mainnet, storyProtocol],
  connectors: [
    injected(), // MetaMask/Injected wallets
  ],
  transports: {
    [mainnet.id]: http(),
    [storyProtocol.id]: http("https://mainnet.storyrpc.io"),
  },
  ssr: true,
  // storage: undefined, // Allows wallet persistence
});
