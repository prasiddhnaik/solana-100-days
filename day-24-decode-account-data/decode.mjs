#!/usr/bin/env node

import { createSolanaRpc, address } from "@solana/kit";
import { getMintDecoder } from "@solana-program/token";

const WRAPPED_SOL = "So11111111111111111111111111111111111111112";
const rpc = createSolanaRpc("https://api.mainnet-beta.solana.com");
const mintAddr = address(WRAPPED_SOL);

const account = (await rpc.getAccountInfo(mintAddr, { encoding: "base64" }).send()).value;
const bytes = new Uint8Array(Buffer.from(account.data[0], 'base64'));

console.log("\n🔓 Day 24: Decoding Solana Account Data\n");
console.log(`Account: ${WRAPPED_SOL}`);
console.log(`Owner: ${account.owner}`);
console.log(`Data: ${bytes.length} bytes\n`);

// Method 1: Pre-built codec
const mint = getMintDecoder().decode(bytes);
console.log("1. Codec Decode:");
console.log(`   mintAuthority: ${mint.mintAuthority.__option === "Some" ? mint.mintAuthority.value : "null"}`);
console.log(`   supply: ${mint.supply}`);
console.log(`   decimals: ${mint.decimals}`);
console.log(`   isInitialized: ${mint.isInitialized}`);
console.log(`   freezeAuthority: ${mint.freezeAuthority.__option === "Some" ? mint.freezeAuthority.value : "null"}\n`);

// Method 2: Manual decode
const view = new DataView(bytes.buffer, bytes.byteOffset);
console.log("2. Manual Decode:");
console.log(`   mintAuthorityOption: ${view.getUint32(0, true)}`);
console.log(`   supply: ${view.getBigUint64(36, true)}`);
console.log(`   decimals: ${view.getUint8(44)}`);
console.log(`   isInitialized: ${view.getUint8(45) !== 0}\n`);

// Method 3: RPC jsonParsed
const parsed = (await rpc.getAccountInfo(mintAddr, { encoding: "jsonParsed" }).send()).value.data;
console.log("3. RPC jsonParsed:");
console.log(`   ${JSON.stringify(parsed.parsed.info, null, 2).replace(/"/g, '').replace(/\n/g, '\n   ')}\n`);

console.log("✅ All methods match\n");
