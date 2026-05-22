import 'dotenv/config';
import { ethers } from 'ethers';
import { BASE_CONFIG, TOKENS, QUOTE_CONFIG } from './config.js';
import { getAllQuotes, calculateArbitrage } from './quoter.js';

const SEPARATOR = '─'.repeat(70);
const HEADER   = '═'.repeat(70);

/**
 * Format token amount for display
 */
function formatToken(amount, decimals = 18, symbol = '') {
  const formatted = ethers.formatUnits(amount, decimals);
  return symbol ? `${formatted} ${symbol}` : formatted;
}

function trendIndicator(current, prev) {
  if (prev === undefined) return '';
  const delta = current - prev;
  if (Math.abs(delta) < 0.01) return ' ─';
  return delta > 0 ? ' ▲' : ' ▼';
}

/**
 * Display quotes from all DEXes
 */
function displayQuotes(quotes, amountIn, prevPrices = {}) {
  console.log('\n📊 Price Quotes:');
  console.log(SEPARATOR);
  console.log(`Input: ${formatToken(amountIn, 18, 'WETH')}`);
  console.log(SEPARATOR);

  const amountInF = Number(ethers.formatUnits(amountIn, 18));
  quotes.forEach((quote, index) => {
    const pricePerWETH = quote.amountOut > 0n
      ? Number(ethers.formatUnits(quote.amountOut, 6)) / amountInF
      : 0;

    const feeTierStr = quote.fee != null ? ` (${quote.fee / 10000}%)` : '';
    console.log(`\n${index + 1}. ${quote.dex}${feeTierStr}`);
    console.log(`   Output: ${formatToken(quote.amountOut, 6, 'USDC')}`);
    console.log(`   Price: ${pricePerWETH.toFixed(2)} USDC per WETH${trendIndicator(pricePerWETH, prevPrices[quote.dex])}`);
    if (quote.gasEstimate > 0n) {
      console.log(`   Gas Estimate: ${quote.gasEstimate.toString()}`);
    }
  });

  console.log('\n' + SEPARATOR);
}

/**
 * Display arbitrage opportunity
 */
function displayArbitrage(arbitrage, amountIn) {
  console.log('\n💰 Arbitrage Opportunity:');
  console.log(SEPARATOR);

  if (!arbitrage) {
    console.log('⚠️  Insufficient valid quotes — one or more DEXes failed to respond.');
    console.log(SEPARATOR);
    return null;
  }

  if (arbitrage.profitBeforeGas <= 0n) {
    console.log('❌ No profitable arbitrage opportunity found.');
    console.log(SEPARATOR);
    return null;
  }

  const profitUSDC = Number(ethers.formatUnits(arbitrage.profitBeforeGas, 6));
  const gasCostETH = ethers.formatUnits(arbitrage.gasCost, 18);

  // Price spread % = profit / buy-side price
  const buyQuote  = arbitrage.quotes.find(q => q.dex === arbitrage.buyFrom);
  const sellQuote = arbitrage.quotes.find(q => q.dex === arbitrage.sellTo);
  if (buyQuote && sellQuote && buyQuote.amountOut > 0n) {
    const spreadPct = (Number(sellQuote.amountOut - buyQuote.amountOut) / Number(buyQuote.amountOut)) * 100;
    console.log(`\n📐 Price Spread: ${spreadPct.toFixed(4)}%`);
  }

  console.log(`\n📈 Strategy:`);
  console.log(`   1. Buy ${formatToken(amountIn, 18, 'WETH')} on ${arbitrage.buyFrom}`);
  console.log(`   2. Sell on ${arbitrage.sellTo}`);
  console.log(`\n💵 Profit (before gas): ${profitUSDC.toFixed(4)} USDC`);
  console.log(`⛽ Estimated Gas Cost: ${gasCostETH} ETH`);

  // Convert gas cost to USDC equivalent (rough estimate)
  // Use the best (highest) output quote for the ETH price so the estimate
  // matches what the sell leg would actually realise.
  const bestQuote = arbitrage.quotes.reduce(
    (best, q) => (q.amountOut > (best?.amountOut ?? 0n) ? q : best),
    null,
  );
  let netProfit = null;
  if (bestQuote && bestQuote.amountOut > 0n) {
    const amountInF = Number(ethers.formatUnits(amountIn, 18));
    const ethPrice = Number(ethers.formatUnits(bestQuote.amountOut, 6)) / amountInF;
    const gasCostUSDC = Number(gasCostETH) * ethPrice;
    netProfit = profitUSDC - gasCostUSDC;

    console.log(`⛽ Gas Cost in USDC: ~${gasCostUSDC.toFixed(4)} USDC`);
    console.log(`\n✨ Net Profit: ${netProfit.toFixed(4)} USDC`);

    if (netProfit >= QUOTE_CONFIG.minProfitUSD) {
      console.log(`\n🚀 PROFITABLE! Exceeds minimum threshold of ${QUOTE_CONFIG.minProfitUSD} USDC`);
      console.log(`   → Ready to execute arbitrage contract`);
    } else {
      console.log(`\n⚠️  Below minimum threshold of ${QUOTE_CONFIG.minProfitUSD} USDC`);
      console.log(`   → Not executing (would lose money after gas)`);
    }
  }

  console.log(SEPARATOR);
  return netProfit;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Single scan pass
 * @param {ethers.Provider} provider
 * @param {number} scanCount - 1-based scan number (0 = run-once, no label)
 */
async function scan(provider, scanCount = 0, prevPrices = {}) {
  const timestamp = new Date().toLocaleTimeString();
  const scanLabel = scanCount > 0 ? ` #${scanCount}` : '';
  console.log(`\n[${timestamp}] 🔄 Fetching quotes${scanLabel}...`);
  const scanStart = Date.now();

  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice ?? 0n;
  if (gasPrice === 0n) {
    console.warn('⚠️  Gas price unavailable — gas cost estimate will be 0 (results may be misleading)');
  }
  console.log(`⛽ Current gas price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);

  const amountIn = ethers.parseEther(QUOTE_CONFIG.amount);
  const quotes = await getAllQuotes(provider, TOKENS.WETH, TOKENS.USDC, amountIn);

  displayQuotes(quotes, amountIn, prevPrices);

  const arbitrage = calculateArbitrage(quotes, gasPrice, QUOTE_CONFIG.estimatedGasUnits);
  const netProfit = displayArbitrage(arbitrage, amountIn);

  const elapsed = (Date.now() - scanStart) / 1000;
  console.log(`\n⏱  Scan completed in ${elapsed.toFixed(1)}s`);

  const amountInF = Number(ethers.formatUnits(amountIn, 18));
  const prices = {};
  quotes.forEach(q => {
    if (q.amountOut > 0n) {
      prices[q.dex] = Number(ethers.formatUnits(q.amountOut, 6)) / amountInF;
    }
  });

  return { netProfit, elapsed, prices };
}

function displaySummary(stats) {
  console.log('\n' + HEADER);
  console.log('📊 Session Summary');
  console.log(HEADER);
  console.log(`  Total scans:      ${stats.totalScans}`);
  console.log(`  With opportunity: ${stats.profitableScans}`);
  if (stats.totalScans > 0) {
    const avgTime = (stats.totalElapsed / stats.totalScans).toFixed(1);
    console.log(`  Avg scan time:    ${avgTime}s`);
  }
  if (stats.bestNetProfit !== null) {
    console.log(`  Best net profit:  ${stats.bestNetProfit.toFixed(4)} USDC`);
  } else {
    console.log(`  Best net profit:  —`);
  }
  console.log(HEADER + '\n');
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Base Chain Arbitrage Scanner');
  console.log(HEADER);
  console.log(`RPC: ${BASE_CONFIG.rpcUrl}`);
  console.log(`Pair: WETH/USDC`);
  if (QUOTE_CONFIG.scanIntervalMs > 0) {
    console.log(`Interval: ${QUOTE_CONFIG.scanIntervalMs / 1000}s`);
  }
  console.log(HEADER);

  const provider = new ethers.JsonRpcProvider(BASE_CONFIG.rpcUrl);

  const network = await provider.getNetwork();
  console.log(`✅ Connected to chain ID: ${network.chainId}`);

  if (QUOTE_CONFIG.scanIntervalMs > 0) {
    console.log('Press Ctrl+C to stop.\n');

    const stats = { totalScans: 0, profitableScans: 0, bestNetProfit: null, totalElapsed: 0 };

    process.on('SIGINT', () => {
      console.log('\n\n👋 Stopped.');
      displaySummary(stats);
      process.exit(0);
    });

    let scanCount = 0;
    let prevPrices = {};
    while (true) {
      try {
        const result = await scan(provider, ++scanCount, prevPrices);
        stats.totalScans++;
        stats.totalElapsed += result.elapsed;
        prevPrices = result.prices;
        if (result.netProfit !== null) {
          stats.profitableScans++;
          if (stats.bestNetProfit === null || result.netProfit > stats.bestNetProfit) {
            stats.bestNetProfit = result.netProfit;
          }
        }
      } catch (error) {
        console.error('\n❌ Scan error:', error.message);
        if (error.code === 'NETWORK_ERROR') {
          console.error('   → Check your RPC URL in .env file');
        }
      }
      await sleep(QUOTE_CONFIG.scanIntervalMs);
    }
  } else {
    try {
      await scan(provider);
    } catch (error) {
      console.error('\n❌ Error:', error.message);
      if (error.code === 'NETWORK_ERROR') {
        console.error('   → Check your RPC URL in .env file');
      }
    }
    console.log('\n');
  }
}

// Run the scanner
main().catch(console.error);
