// Base Chain Configuration
export const BASE_CONFIG = {
  chainId: 8453,
  rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
};

// Token Addresses on Base
export const TOKENS = {
  WETH: '0x4200000000000000000000000000000000000006',
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
};

// Uniswap V3 on Base
export const UNISWAP_V3 = {
  name: 'Uniswap V3',
  quoter: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a', // QuoterV2
  router: '0x2626664c2603336E57B271c5C0b26F421741e481', // SwapRouter02
  factory: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
  poolFee: 500, // 0.05% fee tier (WETH/USDC typically uses 500 or 3000)
};

// Aerodrome on Base
export const AERODROME = {
  name: 'Aerodrome',
  quoter: '0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0', // Aerodrome Quoter
  router: '0xcF77a3Ba9A5CA04BB4E9e3d4D3e7B4d4c7d4e5E3', // Aerodrome Router (需要確認)
  factory: '0x420DD381b31aEf6683db6B902084cB0FFECe40Da',
};

// Quote Configuration
export const QUOTE_CONFIG = {
  // Amount of WETH to quote (in ether units)
  amount: process.env.QUOTE_AMOUNT || '1.0',
  // Minimum profit in USD to execute
  minProfitUSD: parseFloat(process.env.MIN_PROFIT_USD || '10'),
  // Gas estimate for arbitrage transaction
  estimatedGasUnits: 300000n,
};
