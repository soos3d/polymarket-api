# Universal Accounts + Polymarket API Demo

Demo for using Particle Network's Universal Accounts with Polymarket's CLOB API to programmatically place prediction market orders.

## 📁 Project Structure

```
├── poly-trade.ts          # Main script - Place orders on Polymarket
├── mockup.ts              # Reference - Universal Accounts integration
├── utils/
│   ├── check-balance.ts   # Check MATIC and USDC.e balances
│   ├── check-market.ts    # View market prices and order book
│   └── check-orders.ts    # View your open orders and trades
└── .env.sample            # Environment variables template
```

## 🔄 How It Works

### The Flow

1. **Setup Wallet & Provider**
   - Connect to Polygon network via RPC
   - Initialize wallet with private key
   - Create USDC.e contract instance

2. **Set USDC Allowances** 
   - Check current allowances for Polymarket exchange contracts
   - Approve unlimited USDC.e spending if needed (one-time setup)
   - Wait for blockchain confirmation and indexing

3. **Authenticate with Polymarket**
   - Generate API credentials using EIP-712 signature
   - Create authenticated CLOB client for trading

4. **Place Order**
   - Define order parameters (market, side, size, price)
   - Submit limit order to Polymarket's order book
   - Receive order ID and status

5. **Order Matching**
   - Order sits in the order book as a "maker" order
   - Executes when someone matches your price (becomes "taker")
   - Check status with `utils/check-orders.ts`

### Key Concepts

**Limit Orders vs Market Orders**
- **Limit Order**: Specify your price, wait for a match (what this demo does)
- **Market Order**: Set price at/above current ask to fill immediately

**USDC.e vs Native USDC**
- Polymarket uses **USDC.e** (`0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`)
- This is bridged USDC from Ethereum, not Polygon's native USDC
- Make sure you have USDC.e, not native USDC!

**Order Book Mechanics**
- Orders don't create blockchain transactions until filled
- Your order lives in Polymarket's off-chain order book
- Only matched trades settle on-chain

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.sample` to `.env` and fill in your values:
```bash
cp .env.sample .env
```

Required variables:
```env
POLYGON_RPC=your_polygon_rpc_url
OWNER_EOA=your_wallet_address
OWNER_EOA_PK=your_private_key
```

### 3. Get USDC.e
Make sure you have USDC.e (bridged USDC) in your wallet:
- Bridge from Ethereum, or
- Swap native USDC → USDC.e on a DEX (Uniswap, QuickSwap)

### 4. Check Your Balance
```bash
npx ts-node utils/check-balance.ts
```

### 5. Check Market Prices
```bash
npx ts-node utils/check-market.ts
```

### 6. Place an Order
Edit `poly-trade.ts` to set your desired market, size, and price:
```typescript
const tokenId = "your_market_token_id";
const side = Side.BUY;  // or Side.SELL
const size = 5.0;       // minimum 5 shares
const price = 0.50;     // price per share in USD
```

Then run:
```bash
npx ts-node poly-trade.ts
```

### 7. Check Your Orders
```bash
npx ts-node utils/check-orders.ts
```

## 📝 Important Notes

- **Minimum Order Size**: Most markets require at least 5 shares
- **Gas Fees**: Keep some MATIC for transaction fees (approvals, etc.)
- **Order Execution**: Limit orders only fill when matched at your price
- **API Keys**: Generated automatically on first run and cached by Polymarket

## 🔗 Resources

- [Polymarket CLOB Docs](https://docs.polymarket.com/)
- [Particle Network Docs](https://developers.particle.network/)
- [USDC.e Contract](https://polygonscan.com/token/0x2791bca1f2de4661ed88a30c99a7a9449aa84174)
