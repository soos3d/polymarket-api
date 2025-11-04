/**
 * Check Your Orders
 * 
 * Utility script to view your open orders and recent trades on Polymarket.
 * Shows order status, fill progress, and trade history.
 */

import { Wallet, ethers } from "ethers";
import { ClobClient } from "@polymarket/clob-client";
import dotenv from "dotenv";

dotenv.config();

async function checkOrders() {
  console.log("=== Checking Polymarket Orders ===\n");

  const host = "https://clob.polymarket.com";
  const chainId = 137;
  const rpcUrl = process.env.POLYGON_RPC!;
  const privateKey = process.env.OWNER_EOA_PK!;
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const signer = new Wallet(privateKey, provider);
  const funderAddress = process.env.OWNER_EOA!;
  const signatureType = 0;

  console.log(`Wallet Address: ${funderAddress}\n`);

  // Create client and get credentials
  const l1Client = new ClobClient(host, chainId, signer);
  const creds = await l1Client.createOrDeriveApiKey();
  
  const l2Client = new ClobClient(
    host,
    chainId,
    signer,
    creds,
    signatureType,
    funderAddress
  );

  // Get open orders
  console.log("📋 Fetching open orders...");
  try {
    const openOrders = await l2Client.getOpenOrders();
    
    if (openOrders.length === 0) {
      console.log("❌ No open orders found\n");
    } else {
      console.log(`✅ Found ${openOrders.length} open order(s):\n`);
      openOrders.forEach((order, index) => {
        console.log(`Order ${index + 1}:`);
        console.log(`  ID: ${order.id}`);
        console.log(`  Market: ${order.market}`);
        console.log(`  Asset ID: ${order.asset_id}`);
        console.log(`  Side: ${order.side}`);
        console.log(`  Size: ${order.size_matched}/${order.original_size}`);
        console.log(`  Price: $${order.price}`);
        console.log(`  Status: ${order.status}`);
        console.log(`  Created: ${new Date(order.created_at).toLocaleString()}`);
        console.log();
      });
    }
  } catch (err: any) {
    console.error("Error fetching orders:", err.message);
  }

  // Get recent trades
  console.log("📊 Fetching recent trades...");
  try {
    const trades = await l2Client.getTrades();
    
    if (trades.length === 0) {
      console.log("❌ No trades found\n");
    } else {
      console.log(`✅ Found ${trades.length} trade(s):\n`);
      trades.slice(0, 5).forEach((trade, index) => {
        console.log(`Trade ${index + 1}:`);
        console.log(`  ID: ${trade.id}`);
        console.log(`  Market: ${trade.market}`);
        console.log(`  Side: ${trade.side}`);
        console.log(`  Size: ${trade.size}`);
        console.log(`  Price: $${trade.price}`);
        console.log();
      });
    }
  } catch (err: any) {
    console.error("Error fetching trades:", err.message);
  }
}

checkOrders().catch(console.error);
