#!/usr/bin/env node

/**
 * Force Fail Script - Creates on-chain transaction failures for learning
 * 
 * This script demonstrates:
 * 1. How preflight simulation catches errors
 * 2. How skipPreflight bypasses those checks
 * 3. What on-chain failures look like in CLI and Explorer
 */

import {
  address,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstruction,
  signTransactionMessageWithSigners,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  lamports,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const DEVNET_RPC_URL = "https://api.devnet.solana.com";
const DEFAULT_KEYPAIR_PATH = join(homedir(), ".config", "solana", "id.json");

async function loadKeypair(keypairPath) {
  const keypairData = JSON.parse(readFileSync(keypairPath, "utf-8"));
  return await createKeyPairSignerFromBytes(new Uint8Array(keypairData));
}

async function main() {
  console.log("\n🔥 Force Fail Script - Creating on-chain failure\n");

  // Load the funded wallet
  const fundedWallet = await loadKeypair(DEFAULT_KEYPAIR_PATH);
  const fundedAddress = fundedWallet.address;

  console.log(`Using funded wallet: ${fundedAddress}`);

  // Initialize RPC
  const rpc = createSolanaRpc(DEVNET_RPC_URL);

  // Check balance
  const balanceResult = await rpc.getBalance(fundedAddress).send();
  const balanceSol = Number(balanceResult.value) / 1_000_000_000;
  console.log(`Balance: ${balanceSol.toFixed(9)} SOL\n`);

  // Try to send MORE than the balance
  const wayTooMuchLamports = balanceResult.value + BigInt(1_000_000_000); // balance + 1 SOL

  console.log(`Attempting to send ${(Number(wayTooMuchLamports) / 1_000_000_000).toFixed(9)} SOL`);
  console.log(`(Current balance: ${balanceSol.toFixed(9)} SOL + 1 SOL = guaranteed failure)\n`);

  const brokeWalletAddress = "E6PQyM7VSFYZQvnK6gCdZyos78j4pacgDAyAgeVGFF9A";

  const transferInstruction = getTransferSolInstruction({
    source: fundedWallet,
    destination: address(brokeWalletAddress),
    amount: lamports(wayTooMuchLamports),
  });

  console.log("Building transaction...");

  // Get latest blockhash
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  // Create transaction
  let transactionMessage = createTransactionMessage({ version: 0 });
  transactionMessage = setTransactionMessageFeePayerSigner(fundedWallet, transactionMessage);
  transactionMessage = setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, transactionMessage);
  transactionMessage = appendTransactionMessageInstruction(transferInstruction, transactionMessage);

  // Sign
  const signedTransaction = await signTransactionMessageWithSigners(transactionMessage);
  const signature = getSignatureFromTransaction(signedTransaction);
  const wireTransaction = getBase64EncodedWireTransaction(signedTransaction);

  console.log(`Expected signature: ${signature}`);
  console.log("\n📤 Attempt 1: Sending with normal preflight checks...\n");

  try {
    // First try - normal preflight (should catch the error)
    const result = await rpc
      .sendTransaction(wireTransaction, {
        encoding: "base64",
        skipPreflight: false,
        preflightCommitment: "processed",
      })
      .send();

    console.log(`Transaction sent: ${result}`);
    console.log("(This shouldn't happen - the transaction should have been caught)\n");

  } catch (error) {
    console.log(`❌ BLOCKED by preflight simulation: ${error.message}\n`);
    console.log("✅ This is GOOD - the RPC caught the error before charging fees!\n");
    console.log("Now trying with skipPreflight=true to force it on-chain...\n");

    try {
      // Second try - skip preflight to force on-chain execution
      const result = await rpc
        .sendTransaction(wireTransaction, {
          encoding: "base64",
          skipPreflight: true,
        })
        .send();

      console.log(`📤 Transaction forced through: ${result}`);
      console.log("\n⏳ Waiting for on-chain failure...\n");

      // Poll for status
      for (let attempts = 0; attempts < 30; attempts++) {
        const status = await rpc.getSignatureStatuses([signature]).send();

        if (status.value[0]) {
          const txStatus = status.value[0];

          if (txStatus.err) {
            console.log("\n" + "=".repeat(60));
            console.log("❌ TRANSACTION FAILED ON-CHAIN!");
            console.log("=".repeat(60));
            console.log(`\n📋 Signature: ${signature}`);
            console.log(`\n💥 Error: ${JSON.stringify(txStatus.err, null, 2)}`);

            const feeSol = txStatus.fee ? Number(BigInt(txStatus.fee.toString())) / 1_000_000_000 : null;
            console.log(`\n💸 Fee paid: ${feeSol ? feeSol.toFixed(9) : 'N/A'} SOL`);
            console.log(`   (Yes, failed transactions still cost fees!)`);

            console.log(`\n⚡ Compute units: ${txStatus.computeUnitsConsumed || 'N/A'}`);

            console.log("\n" + "=".repeat(60));
            console.log("\n🔍 Inspect with CLI:");
            console.log(`solana confirm -v ${signature} --url devnet`);
            console.log("\n🌐 View on Explorer:");
            console.log(`https://explorer.solana.com/tx/${signature}?cluster=devnet`);
            console.log("\n📡 Stream logs in real-time:");
            console.log(`solana logs --url devnet`);
            console.log("\n" + "=".repeat(60));
            return;
          }

          if (txStatus.confirmationStatus === "confirmed" || txStatus.confirmationStatus === "finalized") {
            console.log("\n⚠️  Transaction confirmed (unexpected success)");
            return;
          }
        }

        process.stdout.write(`⏳ Polling... (${attempts + 1}/30)\r`);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      console.log("\n\n⏱️  Timeout waiting for status");

    } catch (error2) {
      console.log(`\n💥 Also failed to send: ${error2.message}`);
    }
  }
}

main().catch(console.error);
