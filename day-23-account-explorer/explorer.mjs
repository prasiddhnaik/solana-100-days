#!/usr/bin/env node

/**
 * Solana Account Explorer
 * 
 * A CLI tool to inspect any Solana account and display
 * its details in a clean, readable format.
 * 
 * Usage: node explorer.mjs <ADDRESS>
 * Example: node explorer.mjs TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
 */

import { createSolanaRpc, address } from "@solana/kit";

// Devnet RPC endpoint
const DEVNET_RPC_URL = "https://api.devnet.solana.com";

// Known program address mapping for friendly names
const KNOWN_PROGRAMS = {
  "11111111111111111111111111111111": "System Program",
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA": "Token Program",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCQBMQyKL8": "Token-2022 Program",
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL": "Associated Token Program",
  "BPFLoader2111111111111111111111111111111111": "BPF Loader (Programs)",
  "BPFLoaderUpgradeab1e11111111111111111111111": "BPF Upgradeable Loader",
  "NativeLoader1111111111111111111111111111111": "Native Loader (Built-ins)",
  "Stake11111111111111111111111111111111111111": "Stake Program",
  "Vote111111111111111111111111111111111111111": "Vote Program",
  "AddressLookupTab1e1111111111111111111111111": "Address Lookup Table Program",
  "ComputeBudget111111111111111111111111111111": "Compute Budget Program",
  "Config1111111111111111111111111111111111111": "Config Program",
  "Ed25519SigVerify111111111111111111111111111": "Ed25519 Signature Verify Program",
  "Secp256k1SigVerify111111111111111111111111": "Secp256k1 Signature Verify Program",
  "So11111111111111111111111111111111111111112": "Wrapped SOL (wSOL)",
};

/**
 * Format a public key for display (first 4 + ... + last 4)
 */
function formatAddress(addr) {
  const str = addr.toString();
  return `${str.slice(0, 4)}...${str.slice(-4)}`;
}

/**
 * Get friendly name for a program address
 */
function getFriendlyName(addr) {
  const str = addr.toString();
  return KNOWN_PROGRAMS[str] || null;
}

/**
 * Parse account data from RPC response (handles base64 format)
 * @solana/kit returns data as a base64 string
 */
function parseAccountData(dataField) {
  if (!dataField || typeof dataField !== 'string') return [];

  try {
    // Decode base64 to bytes
    const binaryString = atob(dataField);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    return [];
  }
}

/**
 * Truncate data for display
 */
function formatData(dataField, maxBytes = 64) {
  const byteArray = parseAccountData(dataField);

  if (!byteArray || byteArray.length === 0) {
    return "(empty)";
  }

  const totalBytes = byteArray.length;

  if (totalBytes <= maxBytes) {
    // Show all bytes in hex
    const hexString = Array.from(byteArray)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");
    return `[${totalBytes} bytes] ${hexString}`;
  }

  // Truncate - show first 32 bytes, then ... then last 8 bytes
  const firstPart = Array.from(byteArray.slice(0, 32));
  const lastPart = Array.from(byteArray.slice(-8));

  const firstHex = firstPart
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
  const lastHex = lastPart
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");

  return `[${totalBytes} bytes total] ${firstHex} ... ${lastHex}\n         (truncated for display)`;
}

/**
 * Print a divider line
 */
function printDivider() {
  console.log("═".repeat(70));
}

/**
 * Main explorer function
 */
async function main() {
  console.log("\n🔍 Solana Account Explorer\n");

  // Step 1: Get address from command line
  const targetAddress = process.argv[2];

  if (!targetAddress) {
    console.log("❌ Error: No address provided\n");
    console.log("Usage: node explorer.mjs <ADDRESS>\n");
    console.log("Examples:");
    console.log("  node explorer.mjs TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
    console.log("  node explorer.mjs 11111111111111111111111111111111");
    console.log("  node explorer.mjs $(solana address)");
    console.log("");
    process.exit(1);
  }

  try {
    // Step 2: Initialize RPC connection
    const rpc = createSolanaRpc(DEVNET_RPC_URL);

    // Step 3: Parse the address
    let addr;
    try {
      addr = address(targetAddress);
    } catch (error) {
      console.log(`❌ Invalid Solana address: ${targetAddress}\n`);
      console.log("Addresses must be base58-encoded 32-byte public keys.\n");
      process.exit(1);
    }

    console.log(`Exploring: ${targetAddress}\n`);

    // Step 4: Fetch balance
    const balanceResult = await rpc.getBalance(addr).send();
    const lamports = balanceResult.value;
    const sol = Number(lamports) / 1_000_000_000;

    // Step 5: Fetch account info
    const accountResult = await rpc.getAccountInfo(addr).send();
    const account = accountResult.value;

    // Step 6: Display the results
    printDivider();
    console.log("📊 ACCOUNT SUMMARY");
    printDivider();
    console.log();

    // Address
    console.log(`📝 Public Key:  ${targetAddress}`);
    console.log(`                ${formatAddress(targetAddress)}`);
    console.log();

    // Balance
    console.log(`💰 Balance:     ${sol.toFixed(9)} SOL`);
    console.log(`                ${lamports.toString()} lamports`);
    console.log();

    // Account not found check
    if (!account) {
      console.log("⚠️  Account does not exist on devnet\n");
      console.log("   This could mean:");
      console.log("   - The address has never been funded");
      console.log("   - The address was typed incorrectly");
      console.log("   - You're looking at the wrong network");
      console.log();
      process.exit(0);
    }

    // Owner with friendly name
    const owner = account.owner;
    const ownerStr = owner.toString();
    const ownerFriendly = getFriendlyName(owner);

    console.log(`👤 Owner:       ${ownerStr}`);
    if (ownerFriendly && ownerFriendly !== targetAddress) {
      console.log(`                (${ownerFriendly})`);
    }
    console.log(`                ${formatAddress(ownerStr)}`);
    console.log();

    // Executable status
    const isExecutable = account.executable;
    console.log(`⚡ Executable:  ${isExecutable ? "✅ YES (This is a program)" : "❌ NO (This is a data account)"}`);
    console.log();

    // Rent epoch (legacy field)
    console.log(`🏠 Rent Epoch:  ${account.rentEpoch.toString()}`);
    console.log(`                (Legacy field - no longer actively used)`);
    console.log();

    // Data - use 'space' field if available (allocated space), otherwise calculate from data
    const rawData = parseAccountData(account.data);
    const dataLength = account.space ? Number(account.space) : rawData.length;
    console.log(`📦 Data Size:   ${dataLength} bytes`);
    console.log();

    if (dataLength > 0) {
      console.log(`📄 Data Preview:`);
      console.log(`   ${formatData(account.data)}`);
      console.log();
    }

    // Step 7: Context-aware insights
    printDivider();
    console.log("💡 INSIGHTS");
    printDivider();
    console.log();

    if (isExecutable) {
      console.log("🔧 This is a PROGRAM ACCOUNT");
      console.log("   • Can be invoked by other accounts");

      if (ownerStr === "NativeLoader1111111111111111111111111111111") {
        console.log("   • This is a NATIVE built-in program (part of the validator)");
        console.log("   • Owned by the Native Loader");
      } else {
        console.log("   • Contains compiled BPF bytecode");
        console.log("   • Owned by the BPF Loader");
      }
    } else if (ownerStr === "11111111111111111111111111111111") {
      console.log("👛 This is a SYSTEM WALLET ACCOUNT");
      console.log("   • Holds SOL balance only");
      console.log("   • No custom data storage");
      console.log("   • Owned by System Program (handles transfers)");
    } else if (ownerStr === "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") {
      console.log("🪙 This is a TOKEN ACCOUNT");
      console.log("   • Stores token balances (SPL tokens)");
      console.log("   • Has specific data layout (mint, owner, amount, etc.)");
      console.log("   • Owned by Token Program");
    } else {
      console.log("📦 This is a DATA ACCOUNT");
      console.log("   • Owned by a specific program");
      console.log(`   • Program controls what can be stored/modified`);
    }

    console.log();

    // Explorer links
    printDivider();
    console.log("🔗 QUICK LINKS");
    printDivider();
    console.log();
    console.log(`Solana Explorer: https://explorer.solana.com/address/${targetAddress}?cluster=devnet`);
    console.log(`Solscan:         https://solscan.io/account/${targetAddress}?cluster=devnet`);
    console.log(`SolanaFM:        https://solana.fm/address/${targetAddress}?cluster=devnet-solana`);
    console.log();

  } catch (error) {
    console.log(`\n❌ Error: ${error.message}\n`);
    console.log("Make sure you're connected to the internet and can reach devnet.\n");
    process.exit(1);
  }
}

main().catch(console.error);
