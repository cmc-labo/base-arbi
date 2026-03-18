import { ethers } from 'ethers';
import { TOKENS, UNISWAP_V3, AERODROME } from './config.js';

// Uniswap V3 QuoterV2 ABI (quoteExactInputSingle function)
const UNISWAP_QUOTER_ABI = [
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'tokenIn', type: 'address' },
          { internalType: 'address', name: 'tokenOut', type: 'address' },
          { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
          { internalType: 'uint24', name: 'fee', type: 'uint24' },
          { internalType: 'uint160', name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
        internalType: 'struct IQuoterV2.QuoteExactInputSingleParams',
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'quoteExactInputSingle',
    outputs: [
      { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
      { internalType: 'uint160', name: 'sqrtPriceX96After', type: 'uint160' },
      { internalType: 'uint32', name: 'initializedTicksCrossed', type: 'uint32' },
      { internalType: 'uint256', name: 'gasEstimate', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

// Aerodrome Quoter ABI (getAmountOut function - simplified version)
// Note: Aerodrome may use different function signatures
const AERODROME_QUOTER_ABI = [
  {
    inputs: [
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
      { internalType: 'address', name: 'tokenIn', type: 'address' },
      { internalType: 'address', name: 'tokenOut', type: 'address' },
    ],
    name: 'getAmountOut',
    outputs: [
      { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

/**
 * Get quote from Uniswap V3
 * @param {ethers.Provider} provider
 * @param {string} tokenIn - Input token address
 * @param {string} tokenOut - Output token address
 * @param {bigint} amountIn - Amount in (wei)
 * @param {number} fee - Pool fee tier
 * @returns {Promise<{amountOut: bigint, gasEstimate: bigint}>}
 */
export async function getUniswapV3Quote(provider, tokenIn, tokenOut, amountIn, fee = UNISWAP_V3.poolFee) {
  try {
    const quoter = new ethers.Contract(UNISWAP_V3.quoter, UNISWAP_QUOTER_ABI, provider);

    const params = {
      tokenIn,
      tokenOut,
      amountIn,
      fee,
      sqrtPriceLimitX96: 0, // No price limit
    };

    const [amountOut, , , gasEstimate] = await quoter.quoteExactInputSingle.staticCall(params);

    return {
      amountOut: BigInt(amountOut),
      gasEstimate: BigInt(gasEstimate),
    };
  } catch (error) {
    console.error('Uniswap V3 quote error:', error.message);
    return { amountOut: 0n, gasEstimate: 0n };
  }
}

/**
 * Get quote from Aerodrome
 * @param {ethers.Provider} provider
 * @param {string} tokenIn - Input token address
 * @param {string} tokenOut - Output token address
 * @param {bigint} amountIn - Amount in (wei)
 * @returns {Promise<{amountOut: bigint}>}
 */
export async function getAerodromeQuote(provider, tokenIn, tokenOut, amountIn) {
  try {
    const quoter = new ethers.Contract(AERODROME.quoter, AERODROME_QUOTER_ABI, provider);

    const amountOut = await quoter.getAmountOut(amountIn, tokenIn, tokenOut);

    return {
      amountOut: BigInt(amountOut),
    };
  } catch (error) {
    console.error('Aerodrome quote error:', error.message);
    return { amountOut: 0n };
  }
}

/**
 * Get quotes from all DEXes
 * @param {ethers.Provider} provider
 * @param {string} tokenIn
 * @param {string} tokenOut
 * @param {bigint} amountIn
 * @returns {Promise<Array>}
 */
export async function getAllQuotes(provider, tokenIn, tokenOut, amountIn) {
  const [uniswapQuote, aerodromeQuote] = await Promise.all([
    getUniswapV3Quote(provider, tokenIn, tokenOut, amountIn),
    getAerodromeQuote(provider, tokenIn, tokenOut, amountIn),
  ]);

  return [
    {
      dex: UNISWAP_V3.name,
      amountOut: uniswapQuote.amountOut,
      gasEstimate: uniswapQuote.gasEstimate,
    },
    {
      dex: AERODROME.name,
      amountOut: aerodromeQuote.amountOut,
      gasEstimate: 0n, // Aerodrome quoter may not return gas estimate
    },
  ];
}

/**
 * Calculate arbitrage opportunity
 * @param {Array} quotes - Array of quote objects
 * @param {bigint} gasPrice - Current gas price in wei
 * @param {bigint} estimatedGasUnits - Estimated gas for arbitrage
 * @returns {Object|null}
 */
export function calculateArbitrage(quotes, gasPrice, estimatedGasUnits) {
  if (quotes.length < 2) return null;

  // Find best sell (highest output) and worst buy (lowest output) in O(n)
  const bestSell = quotes.reduce((a, b) => b.amountOut > a.amountOut ? b : a);
  const worstBuy = quotes.reduce((a, b) => b.amountOut < a.amountOut ? b : a);

  // Calculate potential profit (in output token units)
  const profitBeforeGas = bestSell.amountOut - worstBuy.amountOut;

  // Calculate gas cost in wei
  const gasCost = gasPrice * estimatedGasUnits;

  return {
    buyFrom: worstBuy.dex,
    sellTo: bestSell.dex,
    profitBeforeGas,
    gasCost,
    quotes,
  };
}
