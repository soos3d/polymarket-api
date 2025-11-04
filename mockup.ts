// pnpm add @particle-network/universal-account-sdk ethers axios
import { UniversalAccount, CHAIN_ID, SUPPORTED_TOKEN_TYPE } from "@particle-network/universal-account-sdk";
import { Interface, Wallet, parseUnits, toBeHex } from "ethers";
import axios from "axios";

/** ---------- ENV ---------- **/
const PROJECT_ID = process.env.NEXT_PUBLIC_PROJECT_ID!;
const CLIENT_KEY = process.env.NEXT_PUBLIC_CLIENT_KEY!;
const APP_ID = process.env.NEXT_PUBLIC_APP_ID!;

const OWNER_EOA = process.env.OWNER_EOA!;          // EOA address that owns the UA
const OWNER_EOA_PK = process.env.OWNER_EOA_PK!;    // use a secure secret manager
const POLYGON_RPC = process.env.POLYGON_RPC!;

const CLOB_HOST = "https://clob.polymarket.com";   // adjust for your env
const POLY_USDC = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // Polygon USDC
const EXCHANGE = "<POLYMARKET_EXCHANGE_ADDRESS>";  // from Polymarket docs
const OUTCOME_ERC1155 = "<OUTCOME_TOKEN_CONTRACT>";// from market metadata
const TOKEN_ID = "<ERC1155_TOKEN_ID>";             // from market metadata

/** ---------- ORDER INPUTS ---------- **/
const side: "BUY" | "SELL" = "BUY";
const price = 0.42;                // probability [0..1]
const sizeShares = 100;            // shares
const feeRateBps = 0;
const expiration = Math.floor(Date.now() / 1000) + 15 * 60; // 15 min
const orderType = "GTC";           // "GTC" | "FOK" | "FAK" | "GTD"

const USDC_DEC = 6;
const SHARES_DEC = 6;

/** ---------- ABIs ---------- **/
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
];
const ERC1155_ABI = [
  "function setApprovalForAll(address operator, bool approved) external",
];

/** ---------- HELPERS ---------- **/
function computeAmounts(side: "BUY" | "SELL", price: number, size: number) {
  const shares = parseUnits(size.toString(), SHARES_DEC);
  const usdc = parseUnits((price * size).toFixed(USDC_DEC), USDC_DEC);
  return side === "BUY"
    ? { makerAmount: usdc, takerAmount: shares }     // maker pays USDC
    : { makerAmount: shares, takerAmount: usdc };    // maker gives shares
}

async function main() {
  /** 1) Init UA bound to the owner EOA */
  const ua = new UniversalAccount({
    projectId: PROJECT_ID,
    projectClientKey: CLIENT_KEY,
    projectAppUuid: APP_ID,
    ownerAddress: OWNER_EOA,
    tradeConfig: { slippageBps: 100, universalGas: true },
  });

  // Resolve UA addresses
  const sa = await ua.getSmartAccountOptions();
  const maker = sa.evmSmartAccount; // UA contract address (the funder)

  /** 2) Approvals from the UA on Polygon */
  // BUY: UA approves USDC to the exchange
  if (side === "BUY") {
    const erc20 = new Interface(ERC20_ABI);
    const data = erc20.encodeFunctionData("approve", [
      EXCHANGE,
      parseUnits("1000000", USDC_DEC), // big allowance
    ]);

    const approveTx = await ua.createUniversalTransaction({
      chainId: CHAIN_ID.POLYGON_MAINNET,
      // ensure UA has USDC liquidity; expectTokens helps UA route gas/liquidity if needed
      expectTokens: [{ type: SUPPORTED_TOKEN_TYPE.USDC, amount: "0" }],
      transactions: [{ to: POLY_USDC, data, value: toBeHex(0) }],
    });

    // Sign the UA userOp rootHash with the owner EOA and send
    const eoa = new Wallet(OWNER_EOA_PK);
    const uaSig = await eoa.signMessage(approveTx.rootHash);
    await ua.sendTransaction(approveTx, uaSig);
  }

  // SELL: UA grants ERC1155 setApprovalForAll
  if (side === "SELL") {
    
    const erc1155 = new Interface(ERC1155_ABI);
    const data = erc1155.encodeFunctionData("setApprovalForAll", [EXCHANGE, true]);

    const sApprovalTx = await ua.createUniversalTransaction({
      chainId: CHAIN_ID.POLYGON_MAINNET,
      expectTokens: [], // no token expectation; pure approval
      transactions: [{ to: OUTCOME_ERC1155, data, value: toBeHex(0) }],
    });

    const eoa = new Wallet(OWNER_EOA_PK);
    const uaSig = await eoa.signMessage(sApprovalTx.rootHash);
    await ua.sendTransaction(sApprovalTx, uaSig);
  }

    /** 3) Build + sign Polymarket EIP-712 order with the owner EOA */
  const { makerAmount, takerAmount } = computeAmounts(side, price, sizeShares);

  const eip712Domain = {
    name: "Polymarket",
    version: "1",
    chainId: 137,
    verifyingContract: EXCHANGE,
  } as const;

  const types = {
    Order: [
      { name: "salt", type: "uint256" },
      { name: "maker", type: "address" },
      { name: "signer", type: "address" },
      { name: "taker", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "makerAmount", type: "uint256" },
      { name: "takerAmount", type: "uint256" },
      { name: "expiration", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "feeRateBps", type: "uint256" },
      { name: "side", type: "uint8" },          // confirm enum
      { name: "signatureType", type: "uint8" }, // 0=EOA
    ],
  } as const;

  const salt = BigInt("0x" + crypto.randomUUID().replace(/-/g, ""));
  const order = {
    salt: salt.toString(),
    maker,                         // UA pays
    signer: OWNER_EOA,             // EOA signs
    taker: "0x0000000000000000000000000000000000000000",
    tokenId: TOKEN_ID,
    makerAmount: makerAmount.toString(),
    takerAmount: takerAmount.toString(),
    expiration,
    nonce: Date.now(),
    feeRateBps: feeRateBps,
    side: side === "BUY" ? 0 : 1,
    signatureType: 0,              // signer is a plain EOA
  };

  const eoa = new Wallet(OWNER_EOA_PK);
  // ethers v6: _signTypedData(domain, types, value)
  const signature = await eoa.signTypedData(eip712Domain, types as any, order);

  /** 4) Post order to Polymarket CLOB */
  const body = { order: { ...order, signature }, orderType };
  const res = await axios.post(`${CLOB_HOST}/order`, body, {
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": process.env.POLYMARKET_API_KEY!, // if required by your setup
    },
    timeout: 15000,
  });

  console.log("Order response:", res.data);
}

main().catch(console.error);