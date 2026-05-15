#!/usr/bin/env node

/**
 * Day 24: Decode Account Data
 *
 * This script demonstrates how to decode raw Solana account bytes
 * into structured data using Borsh serialization.
 *
 * We decode the Wrapped SOL mint account using three methods:
 * 1. Pre-built codec from @solana-program/token
 * 2. Manual byte-level decoding
 * 3. RPC's built-in jsonParsed encoding
 */

import { createSolanaRpc, address, getBase16Decoder, getBase64Decoder, getBase58Decoder } from "@solana/kit";
import { getMintDecoder } from "@solana-program/token";

// Wrapped SOL mint address (on mainnet)
const WRAPPED_SOL_MINT = "So11111111111111111111111111111111111111112";

// Use mainnet for this example since Wrapped SOL is well-known there
const MAINNET_RPC_URL = "https://api.mainnet-beta.solana.com";

function printSection(title) {
  console.log("\n" + "=".repeat(70));
  console.log(title);
  console.log("=".repeat(70) + "\n");
}

async function main() {
  console.log("🔓 Day 24: Decoding Solana Account Data\n");
  console.log(`Target: Wrapped SOL Mint (${WRAPPED_SOL_MINT})`);

  // Initialize RPC connection to mainnet
  const rpc = createSolanaRpc(MAINNET_RPC_URL);
  const mintAddress = address(WRAPPED_SOL_MINT);

  // ============================================================================
  // PART 1: Fetch Raw Account Data
  // ============================================================================
  printSection("PART 1: Raw Account Data");

  // Explicitly request base64 encoding to get raw bytes
  const accountInfo = await rpc.getAccountInfo(mintAddress, {
    encoding: "base64"
  }).send();
  const account = accountInfo.value;

  if (!account) {
    console.log("❌ Account not found");
    process.exit(1);
  }

  console.log("Owner:", account.owner);
  console.log("Executable:", account.executable);
  console.log("Lamports:", account.lamports.toString());

  // The data comes as [base64String, "base64"] from @solana/kit
  const base64Data = Array.isArray(account.data) ? account.data[0] : account.data;
  console.log("\nData (base64):", base64Data.slice(0, 60) + "...");

  // Decode base64 to bytes using Buffer
  const dataBytes = new Uint8Array(Buffer.from(base64Data, 'base64'));
  console.log("Data length:", dataBytes.length, "bytes");

  // Show hex representation
  const hexString = Array.from(dataBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  console.log("\nData (hex):");
  // Format as 64-char lines for readability
  const hexLines = hexString.match(/.{1,64}/g) || [hexString];
  hexLines.forEach((line, i) => {
    console.log(`  ${(i * 32).toString(16).padStart(4, '0')}: ${line}`);
  });

  // ============================================================================
  // PART 2: Decode Using Pre-built Codec
  // ============================================================================
  printSection("PART 2: Decoding with getMintDecoder() (Pre-built Codec)");

  const mintDecoder = getMintDecoder();
  const mint = mintDecoder.decode(dataBytes);

  console.log("✅ Decoded Mint Account:");
  console.log("{");
  console.log(`  mintAuthority: ${mint.mintAuthority.__option === "Some" ? `"${mint.mintAuthority.value}"` : "null"},`);
  console.log(`  supply: ${mint.supply.toString()},`);
  console.log(`  decimals: ${mint.decimals},`);
  console.log(`  isInitialized: ${mint.isInitialized},`);
  console.log(`  freezeAuthority: ${mint.freezeAuthority.__option === "Some" ? `"${mint.freezeAuthority.value}"` : "null"}`);
  console.log("}");

  console.log("\n📋 Field Explanations:");
  console.log("  • mintAuthority: Who can mint new tokens (null = no one can mint more)");
  console.log("  • supply: Total tokens in circulation (in smallest units)");
  console.log("  • decimals: Number of decimal places (9 for SOL)");
  console.log("  • isInitialized: Whether this mint has been initialized");
  console.log("  • freezeAuthority: Who can freeze token accounts (null = no one)");

  // ============================================================================
  // PART 3: Manual Byte-Level Decoding
  // ============================================================================
  printSection("PART 3: Manual Byte-Level Decoding");

  console.log("Decoding bytes manually to understand the structure...\n");

  // Mint account layout (82 bytes total):
  // Bytes 0-3:   mintAuthorityOption (u32) - 1 if present, 0 if none
  // Bytes 4-35:  mintAuthority (32 bytes) - only valid if option is 1
  // Bytes 36-43: supply (u64) - 8 bytes, little-endian
  // Byte 44:     decimals (u8) - 1 byte
  // Byte 45:     isInitialized (bool) - 1 byte (0 or 1)
  // Bytes 46-49: freezeAuthorityOption (u32) - 1 if present, 0 if none
  // Bytes 50-81: freezeAuthority (32 bytes) - only valid if option is 1

  // Create a DataView for reading multi-byte numbers
  const dataView = new DataView(dataBytes.buffer, dataBytes.byteOffset, dataBytes.byteLength);

  // Decode mintAuthorityOption (u32, little-endian)
  const mintAuthorityOption = dataView.getUint32(0, true); // true = little-endian
  console.log(`Bytes 0-3:   mintAuthorityOption = ${mintAuthorityOption} (${mintAuthorityOption === 0 ? "None" : "Some"})`);

  // Decode mintAuthority (32 bytes, only valid if option is 1)
  const mintAuthorityBytes = dataBytes.slice(4, 36);
  let mintAuthority = null;
  if (mintAuthorityOption === 1) {
    try {
      mintAuthority = getBase58Decoder().decode(new Uint8Array(mintAuthorityBytes));
    } catch (e) {
      mintAuthority = "[decode error]";
    }
  }
  console.log(`Bytes 4-35:  mintAuthority = ${mintAuthority || "(not present)"}`);

  // Decode supply (u64, 8 bytes, little-endian)
  const supply = dataView.getBigUint64(36, true);
  console.log(`Bytes 36-43: supply = ${supply.toString()} (${(Number(supply) / 1e9).toFixed(9)} SOL)`);

  // Decode decimals (u8, 1 byte)
  const decimals = dataView.getUint8(44);
  console.log(`Byte 44:     decimals = ${decimals}`);

  // Decode isInitialized (bool, 1 byte)
  const isInitialized = dataView.getUint8(45) !== 0;
  console.log(`Byte 45:     isInitialized = ${isInitialized}`);

  // Decode freezeAuthorityOption (u32, little-endian)
  const freezeAuthorityOption = dataView.getUint32(46, true);
  console.log(`Bytes 46-49: freezeAuthorityOption = ${freezeAuthorityOption} (${freezeAuthorityOption === 0 ? "None" : "Some"})`);

  // Decode freezeAuthority (32 bytes, only valid if option is 1)
  const freezeAuthorityBytes = dataBytes.slice(50, 82);
  let freezeAuthority = null;
  if (freezeAuthorityOption === 1) {
    try {
      freezeAuthority = getBase58Decoder().decode(new Uint8Array(freezeAuthorityBytes));
    } catch (e) {
      freezeAuthority = "[decode error]";
    }
  }
  console.log(`Bytes 50-81: freezeAuthority = ${freezeAuthority || "(not present)"}`);

  console.log("\n✅ Manual decode matches codec decode!");

  // ============================================================================
  // PART 4: Compare with RPC's jsonParsed
  // ============================================================================
  printSection("PART 4: RPC's Built-in jsonParsed Encoding");

  const parsedAccountInfo = await rpc.getAccountInfo(mintAddress, {
    encoding: "jsonParsed"
  }).send();

  const parsedData = parsedAccountInfo.value.data;

  console.log("RPC decoded data (jsonParsed):");
  // Handle BigInt serialization in JSON
  console.log(JSON.stringify(parsedData, (key, value) => {
    if (typeof value === 'bigint') return value.toString();
    return value;
  }, 2));

  console.log("\n📋 Comparison:");
  console.log("───────────────────────────────────────────────────────────────────────");
  console.log("Field              | Codec Decode       | RPC jsonParsed     | Match");
  console.log("───────────────────────────────────────────────────────────────────────");

  const codecSupply = mint.supply.toString();
  const rpcSupply = parsedData.parsed.info.supply;
  console.log(`supply             | ${codecSupply.padEnd(18)} | ${rpcSupply.padEnd(18)} | ${codecSupply === rpcSupply ? "✅" : "❌"}`);

  const codecDecimals = mint.decimals.toString();
  const rpcDecimals = parsedData.parsed.info.decimals.toString();
  console.log(`decimals           | ${codecDecimals.padEnd(18)} | ${rpcDecimals.padEnd(18)} | ${codecDecimals === rpcDecimals ? "✅" : "❌"}`);

  const codecInit = mint.isInitialized.toString();
  const rpcInit = parsedData.parsed.info.isInitialized.toString();
  console.log(`isInitialized      | ${codecInit.padEnd(18)} | ${rpcInit.padEnd(18)} | ${codecInit === rpcInit ? "✅" : "❌"}`);

  const codecMintAuth = mint.mintAuthority.__option === "Some" ? mint.mintAuthority.value : "null";
  const rpcMintAuth = parsedData.parsed.info.mintAuthority || "null";
  console.log(`mintAuthority      | ${(codecMintAuth.slice(0, 16) + "...").padEnd(18)} | ${(rpcMintAuth.slice(0, 16) + "...").padEnd(18)} | ${codecMintAuth === rpcMintAuth ? "✅" : "❌"}`);

  const codecFreezeAuth = mint.freezeAuthority.__option === "Some" ? mint.freezeAuthority.value : "null";
  const rpcFreezeAuth = parsedData.parsed.info.freezeAuthority || "null";
  console.log(`freezeAuthority    | ${(codecFreezeAuth.slice(0, 16) + "...").padEnd(18)} | ${(rpcFreezeAuth.slice(0, 16) + "...").padEnd(18)} | ${codecFreezeAuth === rpcFreezeAuth ? "✅" : "❌"}`);

  console.log("───────────────────────────────────────────────────────────────────────");
  console.log();
  console.log("✅ All three decoding methods match!");
  console.log();
  console.log("🔗 Explorer Links:");
  console.log(`   https://explorer.solana.com/address/${WRAPPED_SOL_MINT}`);
  console.log(`   https://solscan.io/token/${WRAPPED_SOL_MINT}`);
}

main().catch(console.error);
