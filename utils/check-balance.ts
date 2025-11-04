/**
 * Check Wallet Balances
 * 
 * Utility script to check MATIC and USDC.e balances for your wallet.
 * Useful before placing orders to ensure you have sufficient funds.
 */

import { Wallet, Contract, ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

async function checkBalance() {
  const rpcUrl = process.env.POLYGON_RPC!;
  const privateKey = process.env.OWNER_EOA_PK!;
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const signer = new Wallet(privateKey, provider);
  const address = await signer.getAddress();

  console.log(`Checking balances for: ${address}\n`);

  // USDC contract on Polygon (native USDC)
const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // USDC.e
  const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
  ];

  const usdc = new Contract(USDC_ADDRESS, ERC20_ABI, provider);

  // Check MATIC balance
  const maticBalance = await provider.getBalance(address);
  console.log(`MATIC Balance: ${ethers.utils.formatEther(maticBalance)} MATIC`);

  // Check USDC balance
  const usdcBalance = await usdc.balanceOf(address);
  const decimals = await usdc.decimals();
  console.log(`USDC Balance: ${ethers.utils.formatUnits(usdcBalance, decimals)} USDC`);

  // Calculate how much USDC is needed for the order
  const orderSize = 1.0; // shares
  const orderPrice = 0.15; // price per share
  const orderCost = orderSize * orderPrice;
  console.log(`\nOrder would cost: ${orderCost} USDC`);
  console.log(`You have enough USDC: ${parseFloat(ethers.utils.formatUnits(usdcBalance, decimals)) >= orderCost ? "✅ YES" : "❌ NO"}`);
}

checkBalance().catch(console.error);
