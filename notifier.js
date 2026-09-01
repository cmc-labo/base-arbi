import { NOTIFY_CONFIG } from './config.js';

/**
 * Send a Discord webhook notification for a profitable arbitrage opportunity.
 * No-op if DISCORD_WEBHOOK_URL is not configured.
 * @param {object} opp
 * @param {string} opp.buyFrom
 * @param {string} opp.sellTo
 * @param {number} opp.netProfit
 * @param {number|null} opp.spreadPct
 * @param {number} opp.minProfitUSD
 */
export async function notifyProfitableArbitrage({ buyFrom, sellTo, netProfit, spreadPct, minProfitUSD }) {
  if (!NOTIFY_CONFIG.discordWebhookUrl) return;

  const lines = [
    '🚀 **Arbitrage opportunity!**',
    `Buy on **${buyFrom}**, sell on **${sellTo}**`,
    `Net profit: **${netProfit.toFixed(4)} USDC** (threshold: ${minProfitUSD} USDC)`,
  ];
  if (spreadPct !== null) lines.push(`Spread: ${spreadPct.toFixed(4)}%`);

  try {
    const res = await fetch(NOTIFY_CONFIG.discordWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: lines.join('\n') }),
    });
    if (!res.ok) {
      console.error(`⚠️  Discord notify failed: ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    console.error('⚠️  Discord notify error:', err.message);
  }
}
