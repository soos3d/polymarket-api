/**
 * Check Market Information
 * 
 * Utility script to view current market prices, order book, and trading activity.
 * Use this to determine appropriate order prices before placing trades.
 */

import { Wallet, ethers } from "ethers";
import { ClobClient, Side } from "@polymarket/clob-client";
import dotenv from "dotenv";

dotenv.config();

async function checkMarket() {
  console.log("=== Checking Market Info ===\n");

  const host = "https://clob.polymarket.com";
  const chainId = 137;
  const rpcUrl = process.env.POLYGON_RPC!;
  const privateKey = process.env.OWNER_EOA_PK!;
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const signer = new Wallet(privateKey, provider);

  const client = new ClobClient(host, chainId, signer);

  const tokenId = "34124572068052077909406302056995239675264911172488920973407960367842984448300";

  // Get order book
  console.log("📖 Fetching order book...");
  try {
    const orderBook = await client.getOrderBook(tokenId);
    
    console.log("\n📊 Market Stats:");
    console.log(`  Market: ${orderBook.market}`);
    console.log(`  Asset ID: ${orderBook.asset_id}`);
    
    if (orderBook.bids && orderBook.bids.length > 0) {
      console.log(`\n💰 Best Bid (Highest buy price):`);
      console.log(`  Price: $${orderBook.bids[0].price}`);
      console.log(`  Size: ${orderBook.bids[0].size}`);
    } else {
      console.log(`\n💰 No bids in order book`);
    }
    
    if (orderBook.asks && orderBook.asks.length > 0) {
      console.log(`\n💸 Best Ask (Lowest sell price):`);
      console.log(`  Price: $${orderBook.asks[0].price}`);
      console.log(`  Size: ${orderBook.asks[0].size}`);
    } else {
      console.log(`\n💸 No asks in order book`);
    }

    // Get midpoint price
    const midpoint = await client.getMidpoint(tokenId);
    console.log(`\n📍 Midpoint Price: $${midpoint.mid}`);

    // Get last trade price
    const lastPrice = await client.getLastTradePrice(tokenId);
    console.log(`📍 Last Trade Price: $${lastPrice.price}`);

    console.log(`\n💡 Your order price: $0.10`);
    if (orderBook.asks && orderBook.asks.length > 0) {
      const bestAsk = parseFloat(orderBook.asks[0].price);
      if (0.10 < bestAsk) {
        console.log(`⚠️  Your bid ($0.10) is BELOW the best ask ($${bestAsk})`);
        console.log(`   Your order won't fill unless the price drops to $0.10 or someone accepts your bid.`);
        console.log(`   Consider raising your price to $${bestAsk} or higher to get filled immediately.`);
      } else {
        console.log(`✅ Your bid ($0.10) is at or above the best ask ($${bestAsk})`);
        console.log(`   Your order should fill soon!`);
      }
    }

  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

checkMarket().catch(console.error);
