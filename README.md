# Base Chain Arbitrage Scanner

Base チェーン上の WETH/USDC ペアの価格差を監視し、アービトラージ機会を検出するスクリプトです。

## 特徴

- ✅ **見積もり関数を使用**: `quoteExactInputSingle` を使って、スリッページを含む実際の受取額を取得
- ✅ **複数DEXサポート**: Uniswap V3（全fee tier）と Aerodrome の価格を比較
- ✅ **ガス代計算**: 実際のガス価格・ブロック番号を取得し、純利益を算出
- ✅ **リアルタイム監視**: 設定可能なインターバルで繰り返しスキャン
- ✅ **価格トレンド表示**: 前回スキャンとの差額を ▲/▼ で表示
- ✅ **スプレッド%**: 裁定機会の規模をパーセントで表示
- ✅ **セッションサマリー**: Ctrl+C 終了時に合計スキャン数・最良利益・最大スプレッドを表示
- ✅ **Discord通知**: しきい値を超える利益機会を検出したら Discord Webhook で通知（任意）

## 対応DEX

1. **Uniswap V3** - QuoterV2コントラクトを使用
2. **Aerodrome** - Aerodromeのクォーター機能を使用

## セットアップ

### 1. 依存関係のインストール

```bash
cd arbitrage
npm install
```

### 2. 環境変数の設定

`.env` ファイルを作成:

```bash
cp .env.example .env
```

`.env` を編集:

```env
# Base RPC URL (無料のパブリックRPCまたはAlchemy/Infuraを使用)
BASE_RPC_URL=https://mainnet.base.org

# クォート金額（WETH単位）
QUOTE_AMOUNT=1.0

# 実行する最小利益しきい値（USD）
MIN_PROFIT_USD=10

# スキャン間隔（ミリ秒）。0 を指定すると1回だけ実行して終了
SCAN_INTERVAL_MS=30000

# 利益機会を検出したときの Discord 通知先（任意。空欄なら通知しない）
DISCORD_WEBHOOK_URL=
```

### 3. 実行

```bash
npm start
```

## ファイル構成

```
arbitrage/
├── config.js       # 設定ファイル（トークンアドレス、DEX設定）
├── quoter.js       # クォーター機能（見積もり取得）
├── logger.js       # スキャン結果のJSONログ出力
├── index.js        # メインスクリプト
├── package.json    # プロジェクト設定
├── .env.example    # 環境変数のサンプル
└── README.md       # このファイル
```

## 出力例

```
🔍 Base Chain Arbitrage Scanner
══════════════════════════════════════════════════════════════════════
RPC: https://mainnet.base.org
Pair: WETH/USDC
Interval: 30s
══════════════════════════════════════════════════════════════════════
✅ Connected to chain ID: 8453
Press Ctrl+C to stop.

[12:34:56] 🔄 Fetching quotes #1...
⛽ Gas: 0.05 gwei  |  Block: 29841203

📊 Price Quotes:
──────────────────────────────────────────────────────────────────────
Input: 1.0 WETH
──────────────────────────────────────────────────────────────────────

1. Uniswap V3 (0.05%)
   Output: 2450.123456 USDC
   Price: 2450.12 USDC per WETH
   Gas Estimate: 120000

2. Aerodrome
   Output: 2448.987654 USDC
   Price: 2448.99 USDC per WETH

──────────────────────────────────────────────────────────────────────

💰 Arbitrage Opportunity:
──────────────────────────────────────────────────────────────────────

📐 Price Spread: 0.0464%

📈 Strategy:
   1. Buy 1.0 WETH on Aerodrome
   2. Sell on Uniswap V3

💵 Profit (before gas): 1.1358 USDC
⛽ Estimated Gas Cost: 0.000015 ETH
⛽ Gas Cost in USDC: ~0.0367 USDC

✨ Net Profit: 1.0991 USDC

⚠️  Below minimum threshold of 10 USDC
   → Not executing (would lose money after gas)
──────────────────────────────────────────────────────────────────────

⏱  Scan completed in 2.3s

[12:35:26] 🔄 Fetching quotes #2...
⛽ Gas: 0.05 gwei  |  Block: 29841215

📊 Price Quotes:
──────────────────────────────────────────────────────────────────────
Input: 1.0 WETH
──────────────────────────────────────────────────────────────────────

1. Uniswap V3 (0.05%)
   Output: 2452.441200 USDC
   Price: 2452.44 USDC per WETH ▲ (+2.32)

2. Aerodrome
   Output: 2449.100000 USDC
   Price: 2449.10 USDC per WETH ▲ (+0.11)

──────────────────────────────────────────────────────────────────────
```

Ctrl+C で停止すると、セッションサマリーが表示されます:

```
👋 Stopped.
══════════════════════════════════════════════════════════════════════
📊 Session Summary
══════════════════════════════════════════════════════════════════════
  Total scans:      24
  With opportunity: 3
  Avg scan time:    2.1s
  Best net profit:  4.2183 USDC
  Max spread seen:  0.0847%
══════════════════════════════════════════════════════════════════════
```

## 重要な注意事項

### スリッページについて

このスクリプトは **見積もり関数** (`quoteExactInputSingle`) を使用しています。これにより:

- 静的な価格ではなく、実際の受取額がわかる
- 大量のフラッシュローンを使う場合のスリッページも考慮される
- より正確な利益計算が可能

### 次のステップ: Solidityコントラクト

利益が出ると判断した場合、以下のようなSolidityコントラクトを実行します:

```solidity
// 例: FlashLoanArbitrage.sol
contract FlashLoanArbitrage {
    function executeArbitrage(
        address flashLoanProvider,
        address tokenBorrow,
        uint256 amount,
        address dexBuy,
        address dexSell
    ) external {
        // 1. フラッシュローンで資金を借りる
        // 2. dexBuy で WETH を購入
        // 3. dexSell で WETH を売却
        // 4. フラッシュローンを返済
        // 5. 利益を確保
    }
}
```

## カスタマイズ

### クォート金額の変更

`.env` ファイルで `QUOTE_AMOUNT` を変更:

```env
QUOTE_AMOUNT=10.0  # 10 WETH でクォート
```

### 最小利益しきい値の変更

```env
MIN_PROFIT_USD=50  # 50ドル以上の利益がある場合のみ実行
```

### スキャン間隔の変更

```env
SCAN_INTERVAL_MS=10000  # 10秒ごとにスキャン
SCAN_INTERVAL_MS=0      # 1回だけ実行して終了
```

### 他のDEXを追加

`config.js` と `quoter.js` を編集して、他のDEXを追加できます。

### Discord通知の設定

1. Discordのチャンネル設定 → 連携サービス → ウェブフックから Webhook URL を発行
2. `.env` に設定:

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/xxxx/yyyy
```

`MIN_PROFIT_USD` を超える純利益を検出したスキャンごとに通知が送られます（空欄の場合は通知しません）。

## トラブルシューティング

### RPC接続エラー

- `.env` の `BASE_RPC_URL` が正しいか確認
- Alchemy や Infura などのプロバイダーを使用することを推奨

### クォートエラー

- トークンアドレスが正しいか確認
- プールが存在するか確認（特にAerodromeの場合）
- fee tier（0.05%, 0.3%, 1%）を調整

## ライセンス

MIT

## 免責事項

このスクリプトは教育目的です。実際の取引を行う前に、十分なテストを行ってください。
暗号資産取引にはリスクが伴います。自己責任で使用してください。
