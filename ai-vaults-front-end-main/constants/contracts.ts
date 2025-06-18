// Contract addresses and configuration for all supported chains
export type ChainName =
  | "localhost"
  | "mainnet"
  | "storyProtocol"
  | "flowTestnet"
  | "rootstockTestnet";

export type TokenName = "USDC" | "WIP" | "MockUSDC";
export type VaultName = "OptimizationVault" | "MultiTokenVault" | "Vault";
export type FactoryName = "VaultFactory";
export type PriceIdName = "BTC_USD" | "ETH_USD" | "USDC_USD";

// Story Protocol specific addresses
export interface StoryProtocolConfig {
  wipToken: string;
  royaltyModule: string;
  autoDepositProxy: string;
  optimizationVault: string;
}

export interface ChainConfig {
  chainId: number;
  tokens: Partial<Record<TokenName, string>>;
  vaults: Partial<Record<VaultName, string>>;
  factories: Partial<Record<FactoryName, string>>;
  storyProtocol?: StoryProtocolConfig;
}

export interface TokenConfig {
  decimals: number;
  priceId: PriceIdName;
}

export const CONTRACTS_CONFIG = {
  chains: {
    localhost: {
      chainId: 31337,
      tokens: {},
      vaults: {},
      factories: {},
    },
    mainnet: {
      chainId: 1,
      tokens: {
        USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      },
      vaults: {
        OptimizationVault: "0x670d84987005083dE65C07672241f46dA678D24A",
      },
      factories: {},
      storyProtocol: {
        wipToken: "0x1514000000000000000000000000000000000000",
        royaltyModule: "0xD2f60c40fEbccf6311f8B47c4f2Ec6b040400086",
        autoDepositProxy: "0x4A2348aF9F254b5850C2B75AF30d58cDfA19b256",
        optimizationVault: "0x670d84987005083dE65C07672241f46dA678D24A",
      },
    },
    storyProtocol: {
      chainId: 1514,
      tokens: {
        WIP: "0x1514000000000000000000000000000000000000",
      },
      vaults: {},
      factories: {},
      storyProtocol: {
        wipToken: "0x1514000000000000000000000000000000000000",
        royaltyModule: "0xD2f60c40fEbccf6311f8B47c4f2Ec6b040400086",
        autoDepositProxy: "0x4A2348aF9F254b5850C2B75AF30d58cDfA19b256",
        optimizationVault: "0x670d84987005083dE65C07672241f46dA678D24A",
      },
    },
    flowTestnet: {
      chainId: 545,
      tokens: {
        MockUSDC: "0x...", // Add actual address
      },
      vaults: {
        OptimizationVault: "0x7C65F77a4EbEa3D56368A73A12234bB4384ACB28",
        MultiTokenVault: "0x7C65F77a4EbEa3D56368A73A12234bB4384ACB28",
      },
      factories: {},
    },
    rootstockTestnet: {
      chainId: 31,
      tokens: {
        MockUSDC: "0x...", // Add actual address
      },
      vaults: {
        OptimizationVault: "0x8fDE7A649c782c96e7f4D9D88490a7C5031F51a9",
        Vault: "0x8fDE7A649c782c96e7f4D9D88490a7C5031F51a9",
      },
      factories: {},
    },
  } as Record<ChainName, ChainConfig>,

  // Agent address for all vaults
  defaultAgent: "0xb70649baF7A93EEB95E3946b3A82F8F312477d2b",

  priceIds: {
    BTC_USD:
      "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    ETH_USD:
      "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    USDC_USD:
      "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
  } as Record<PriceIdName, string>,

  tokenConfig: {
    USDC: {
      decimals: 6,
      priceId: "USDC_USD" as PriceIdName,
    },
    WIP: {
      decimals: 18,
      priceId: "USDC_USD" as PriceIdName, // WIP priced in terms of USDC
    },
    MockUSDC: {
      decimals: 6,
      priceId: "USDC_USD" as PriceIdName,
    },
  } as Record<TokenName, TokenConfig>,
} as const;

// Helper functions for tokens and vaults

/**
 * Get chain configuration by chain name
 */
export function getChainConfig(chainName: ChainName): ChainConfig | null {
  return CONTRACTS_CONFIG.chains[chainName] || null;
}

/**
 * Get chain configuration by chain ID
 */
export function getChainConfigById(
  chainId: number
): { name: ChainName; config: ChainConfig } | null {
  const entry = Object.entries(CONTRACTS_CONFIG.chains).find(
    ([, config]) => config.chainId === chainId
  );

  if (entry) {
    return {
      name: entry[0] as ChainName,
      config: entry[1],
    };
  }

  return null;
}

/**
 * Get token address for a specific chain and token
 */
export function getTokenAddress(
  chainName: ChainName,
  tokenName: TokenName
): string | null {
  const config = getChainConfig(chainName);
  return config?.tokens[tokenName] || null;
}

/**
 * Get token address by chain ID
 */
export function getTokenAddressById(
  chainId: number,
  tokenName: TokenName
): string | null {
  const chainInfo = getChainConfigById(chainId);
  return chainInfo?.config.tokens[tokenName] || null;
}

/**
 * Get vault address for a specific chain and vault
 */
export function getVaultAddress(
  chainName: ChainName,
  vaultName: VaultName
): string | null {
  const config = getChainConfig(chainName);
  return config?.vaults[vaultName] || null;
}

/**
 * Get vault address by chain ID
 */
export function getVaultAddressById(
  chainId: number,
  vaultName: VaultName
): string | null {
  const chainInfo = getChainConfigById(chainId);
  return chainInfo?.config.vaults[vaultName] || null;
}

/**
 * Get all available tokens for a specific chain
 */
export function getAvailableTokens(chainName: ChainName): TokenName[] {
  const config = getChainConfig(chainName);
  if (!config) return [];

  return Object.keys(config.tokens) as TokenName[];
}

/**
 * Get all available tokens by chain ID
 */
export function getAvailableTokensById(chainId: number): TokenName[] {
  const chainInfo = getChainConfigById(chainId);
  if (!chainInfo) return [];

  return Object.keys(chainInfo.config.tokens) as TokenName[];
}

/**
 * Get all available vaults for a specific chain
 */
export function getAvailableVaults(chainName: ChainName): VaultName[] {
  const config = getChainConfig(chainName);
  if (!config) return [];

  return Object.keys(config.vaults) as VaultName[];
}

/**
 * Get all available vaults by chain ID
 */
export function getAvailableVaultsById(chainId: number): VaultName[] {
  const chainInfo = getChainConfigById(chainId);
  if (!chainInfo) return [];

  return Object.keys(chainInfo.config.vaults) as VaultName[];
}

/**
 * Get price ID for a specific token
 */
export function getPriceId(priceIdName: PriceIdName): string | null {
  return CONTRACTS_CONFIG.priceIds[priceIdName] || null;
}

/**
 * Get token configuration (decimals and priceId)
 */
export function getTokenConfig(tokenName: TokenName): TokenConfig | null {
  return CONTRACTS_CONFIG.tokenConfig[tokenName] || null;
}

/**
 * Get all supported chain IDs
 */
export function getSupportedChainIds(): number[] {
  return Object.values(CONTRACTS_CONFIG.chains).map((config) => config.chainId);
}

/**
 * Get all supported chain names
 */
export function getSupportedChainNames(): ChainName[] {
  return Object.keys(CONTRACTS_CONFIG.chains) as ChainName[];
}

/**
 * Check if a chain is supported
 */
export function isChainSupported(chainId: number): boolean {
  return getSupportedChainIds().includes(chainId);
}

/**
 * Check if a chain has contracts deployed
 */
export function hasContractsDeployed(chainName: ChainName): boolean {
  const config = getChainConfig(chainName);
  if (!config) return false;

  const hasTokens = Object.keys(config.tokens).length > 0;
  const hasVaults = Object.keys(config.vaults).length > 0;

  return hasTokens || hasVaults;
}

/**
 * Check if a chain has contracts deployed by chain ID
 */
export function hasContractsDeployedById(chainId: number): boolean {
  const chainInfo = getChainConfigById(chainId);
  if (!chainInfo) return false;

  return hasContractsDeployed(chainInfo.name);
}

/**
 * Get all chains with deployed contracts
 */
export function getChainsWithContracts(): {
  name: ChainName;
  config: ChainConfig;
}[] {
  return Object.entries(CONTRACTS_CONFIG.chains)
    .filter(([name]) => hasContractsDeployed(name as ChainName))
    .map(([name, config]) => ({ name: name as ChainName, config }));
}

/**
 * Get factory address for a specific chain and factory
 */
export function getFactoryAddress(
  chainName: ChainName,
  factoryName: FactoryName
): string | null {
  const config = getChainConfig(chainName);
  return config?.factories[factoryName] || null;
}

/**
 * Get factory address by chain ID
 */
export function getFactoryAddressById(
  chainId: number,
  factoryName: FactoryName
): string | null {
  const chainInfo = getChainConfigById(chainId);
  return chainInfo?.config.factories[factoryName] || null;
}

/**
 * Get VaultFactory address for current chain
 */
export function getVaultFactoryAddress(chainName: ChainName): string | null {
  return getFactoryAddress(chainName, "VaultFactory");
}

/**
 * Get VaultFactory address by chain ID
 */
export function getVaultFactoryAddressById(chainId: number): string | null {
  return getFactoryAddressById(chainId, "VaultFactory");
}

/**
 * Get default agent address
 */
export function getDefaultAgentAddress(): string {
  return CONTRACTS_CONFIG.defaultAgent;
}

/**
 * Get Story Protocol configuration for a chain
 */
export function getStoryProtocolConfig(chainName: ChainName): StoryProtocolConfig | null {
  const config = getChainConfig(chainName);
  return config?.storyProtocol || null;
}

/**
 * Get Story Protocol configuration by chain ID
 */
export function getStoryProtocolConfigById(chainId: number): StoryProtocolConfig | null {
  const chainInfo = getChainConfigById(chainId);
  return chainInfo?.config.storyProtocol || null;
}

/**
 * Check if a chain supports Story Protocol integration
 */
export function isStoryProtocolSupported(chainName: ChainName): boolean {
  return getStoryProtocolConfig(chainName) !== null;
}

/**
 * Check if a chain supports Story Protocol integration by chain ID
 */
export function isStoryProtocolSupportedById(chainId: number): boolean {
  return getStoryProtocolConfigById(chainId) !== null;
}
