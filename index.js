import 'dotenv/config';
import { ethers } from 'ethers';
import { BASE_CONFIG, TOKENS, QUOTE_CONFIG } from './config.js';
import { getAllQuotes, calculateArbitrage } from './quoter.js';

/**
 * Format token amount for display
 */
function formatToken(amount, decimals = 18, symbol = '') {
  const formatted = ethers.formatUnits(amount, decimals);
  return symbol ? `${formatted} ${symbol}` : formatted;
}

/**
 * Display quotes from all DEXes
 */
function displayQuotes(quotes, amountIn) {
  console.log('\n📊 Price Quotes:');
  console.log('─'.repeat(70));
  console.log(`Input: ${formatToken(amountIn, 18, 'WETH')}`);
  console.log('─'.repeat(70));

  const amountInF = Number(ethers.formatUnits(amountIn, 18));
  quotes.forEach((quote, index) => {
    const pricePerWETH = quote.amountOut > 0n
      ? Number(ethers.formatUnits(quote.amountOut, 6)) / amountInF
      : 0;

    console.log(`\n${index + 1}. ${quote.dex}`);
    console.log(`   Output: ${formatToken(quote.amountOut, 6, 'USDC')}`);
    console.log(`   Price: ${pricePerWETH.toFixed(2)} USDC per WETH`);
    if (quote.gasEstimate > 0n) {
      console.log(`   Gas Estimate: ${quote.gasEstimate.toString()}`);
    }
  });

  console.log('\n' + '─'.repeat(70));
}

/**
 * Display arbitrage opportunity
 */
function displayArbitrage(arbitrage, amountIn) {
  console.log('\n💰 Arbitrage Opportunity:');
  console.log('─'.repeat(70));

  if (!arbitrage || arbitrage.profitBeforeGas <= 0n) {
    console.log('❌ No profitable arbitrage opportunity found.');
    console.log('─'.repeat(70));
    return;
  }

  const profitUSDC = Number(ethers.formatUnits(arbitrage.profitBeforeGas, 6));
  const gasCostETH = ethers.formatUnits(arbitrage.gasCost, 18);

  console.log(`\n📈 Strategy:`);
  console.log(`   1. Buy ${formatToken(amountIn, 18, 'WETH')} on ${arbitrage.buyFrom}`);
  console.log(`   2. Sell on ${arbitrage.sellTo}`);
  console.log(`\n💵 Profit (before gas): ${profitUSDC.toFixed(4)} USDC`);
  console.log(`⛽ Estimated Gas Cost: ${gasCostETH} ETH`);

  // Convert gas cost to USDC equivalent (rough estimate)
  const bestQuote = arbitrage.quotes.find(q => q.amountOut > 0n);
  if (bestQuote) {
    const amountInF = Number(ethers.formatUnits(amountIn, 18));
    const ethPrice = Number(ethers.formatUnits(bestQuote.amountOut, 6)) / amountInF;
    const gasCostUSDC = Number(gasCostETH) * ethPrice;
    const netProfit = profitUSDC - gasCostUSDC;

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

  console.log('─'.repeat(70));
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Base Chain Arbitrage Scanner');
  console.log('═'.repeat(70));
  console.log(`RPC: ${BASE_CONFIG.rpcUrl}`);
  console.log(`Pair: WETH/USDC`);
  console.log('═'.repeat(70));

  // Connect to Base network
  const provider = new ethers.JsonRpcProvider(BASE_CONFIG.rpcUrl);

  try {
    // Verify connection
    const network = await provider.getNetwork();
    console.log(`✅ Connected to chain ID: ${network.chainId}`);

    // Get current gas price
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || 0n;
    console.log(`⛽ Current gas price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);

    // Parse quote amount
    const amountIn = ethers.parseEther(QUOTE_CONFIG.amount);

    // Get quotes from all DEXes
    console.log('\n🔄 Fetching quotes...');
    const quotes = await getAllQuotes(provider, TOKENS.WETH, TOKENS.USDC, amountIn);

    // Display quotes
    displayQuotes(quotes, amountIn);

    // Calculate arbitrage
    const arbitrage = calculateArbitrage(quotes, gasPrice, QUOTE_CONFIG.estimatedGasUnits);

    // Display arbitrage opportunity
    displayArbitrage(arbitrage, amountIn);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code === 'NETWORK_ERROR') {
      console.error('   → Check your RPC URL in .env file');
    }
  }

  console.log('\n');
}

// Run the scanner
main().catch(console.error);
