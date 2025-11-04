/**
 * Polymarket Order Placement Script
 * 
 * This script demonstrates how to programmatically place a limit order on Polymarket's CLOB.
 * 
 * Steps:
 * 1. Check and set USDC.e allowances for Polymarket exchange contracts
 * 2. Create/derive API credentials for authentication
 * 3. Place a limit order (buy/sell) on a specific market
 * 
 * Note: Orders are limit orders by default and won't execute until matched at your price.
 * To buy immediately, set your price at or above the current market ask price.
 */

import { Wallet, Contract, ethers } from "ethers";
import { ClobClient, OrderType, Side } from "@polymarket/clob-client";
import dotenv from "dotenv";

dotenv.config();

// ========== CONFIGURATION ==========

// Polymarket CLOB endpoint
const POLYMARKET_HOST = "https://clob.polymarket.com";
const CHAIN_ID = 137; // Polygon mainnet

// USDC.e contract (Polymarket uses bridged USDC, not native USDC)
const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

// Polymarket exchange contracts that need USDC approval
const EXCHANGE_ADDRESSES = [
  "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E",
  "0xC5d563A36AE78145C45a50134d48A1215220f80a",
  "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296",
];

// ERC20 ABI for USDC interactions
const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address owner) view returns (uint256)"
];

// ========== MAIN FUNCTION ==========

async function placeOrderExample() {
  console.log("=== Starting Polymarket Order ===");

  // Setup wallet and provider
  const rpcUrl = process.env.POLYGON_RPC!;
  const privateKey = process.env.OWNER_EOA_PK!;
  const funderAddress = process.env.OWNER_EOA!;
  
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const signer = new Wallet(privateKey, provider);
  const usdc = new Contract(USDC_ADDRESS, ERC20_ABI, signer);
  const signatureType = 0; // 0 = EOA, 1 = Polymarket Proxy

  // ========== STEP 1: Set USDC Allowances ==========
  console.log("\n📋 Checking USDC allowances...");
  
  const neededAmount = ethers.utils.parseUnits("1000", 6); // $1000 USDC
  
  for (const spender of EXCHANGE_ADDRESSES) {
    const currentAllowance = await usdc.allowance(funderAddress, spender);
    
    if (currentAllowance.lt(neededAmount)) {
      console.log(`⛽ Approving ${spender}...`);
      
      // Get gas fees and ensure minimum priority fee for Polygon
      const feeData = await provider.getFeeData();
      const minPriorityFee = ethers.utils.parseUnits("30", "gwei");
      const priorityFee = feeData.maxPriorityFeePerGas!.lt(minPriorityFee) 
        ? minPriorityFee 
        : feeData.maxPriorityFeePerGas!;
      
      // Approve max uint256 for unlimited trading
      const tx = await usdc.approve(spender, ethers.constants.MaxUint256, {
        maxFeePerGas: feeData.maxFeePerGas!.add(priorityFee.sub(feeData.maxPriorityFeePerGas!)),
        maxPriorityFeePerGas: priorityFee,
      });
      
      console.log(`   Tx: ${tx.hash}`);
      await tx.wait();
      console.log(`   ✅ Approved`);
      
      // Wait for indexing
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      console.log(`✅ ${spender.slice(0, 10)}... already approved`);
    }
  }

  // ========== STEP 2: Authenticate with Polymarket ==========
  console.log("\n🔑 Authenticating with Polymarket...");
  
  // Create temporary client for API key generation
  const authClient = new ClobClient(POLYMARKET_HOST, CHAIN_ID, signer);
  const creds = await authClient.createOrDeriveApiKey();
  console.log("✅ API credentials obtained");

  // Initialize authenticated client for trading
  const client = new ClobClient(
    POLYMARKET_HOST,
    CHAIN_ID,
    signer,
    creds,
    signatureType,
    funderAddress
  );

  // ========== STEP 3: Check Balance ==========
  const usdcBalance = await usdc.balanceOf(funderAddress);
  console.log(`\n💰 USDC Balance: ${ethers.utils.formatUnits(usdcBalance, 6)} USDC`);

  // ========== STEP 4: Place Order ==========
  console.log("\n📝 Placing order...");
  
  // Order parameters
  const tokenId = "34124572068052077909406302056995239675264911172488920973407960367842984448300";
  const side = Side.BUY;
  const size = 5.0;      // Number of shares (minimum 5 for most markets)
  const price = 0.38;    // Price per share in USD
  const orderType = OrderType.GTC; // Good-Til-Canceled

  console.log(`   ${side}: ${size} shares @ $${price} = $${size * price} total`);
  
  const result = await client.createAndPostOrder(
    { tokenID: tokenId, size, price, side },
    undefined,
    orderType
  );

  // ========== STEP 5: Handle Result ==========
  if (!result.success) {
    console.error("\n❌ Order failed:", result.errorMsg);
    console.error("Response:", JSON.stringify(result, null, 2));
  } else {
    console.log("\n✅ Order placed successfully!");
    console.log(`   Order ID: ${result.orderID}`);
    console.log(`   Status: ${result.status}`);
    console.log("\n💡 Note: This is a limit order. It will only fill when someone");
    console.log("   matches your price. Check current market prices with check-market.ts");
    console.log("\n🔗 View your orders: npx ts-node check-orders.ts");
  }
}

placeOrderExample().catch((err) => {
  console.error("Unexpected error:", err);
});