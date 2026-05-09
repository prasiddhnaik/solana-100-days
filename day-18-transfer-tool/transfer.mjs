#!/usr/bin/env node

/**
 * Solana Transfer Tool
 * A programmatic CLI utility for sending SOL on devnet.
 * Tracks confirmation through all commitment levels: processed -> confirmed -> finalized
 */

import {
  address,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstruction,
  signTransactionMessageWithSigners,
  getSignatureFromTransaction,
  getBase64EncodedWireTransaction,
  lamports,
  devnet,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// Configuration
const DEVNET_RPC_URL = "https://api.devnet.solana.com";
const DEFAULT_KEYPAIR_PATH = join(homedir(), ".config", "solana", "id.json");

/**
 * Prints the usage message and exits
 */
function printUsage() {
  console.log(`
Solana Transfer Tool
====================

Usage: node transfer.mjs <RECIPIENT_ADDRESS> <AMOUNT>

Arguments:
  RECIPIENT_ADDRESS  The Solana address to send SOL to
  AMOUNT           The amount of SOL to send (e.g., 0.05)

Options:
  --keypair <path>  Path to keypair file (default: ~/.config/solana/id.json)
  --help            Show this help message

Examples:
  node transfer.mjs BdtoVEu1zNtkWVfchezBqAbzCnXqkWZeFw8azAGArokJ 0.05
  node transfer.mjs <RECIPIENT> 0.001 --keypair ~/my-keypair.json
`);
  process.exit(0);
}

/**
 * Parses CLI arguments
 */
function parseCLIArgs() {
  const args = process.argv.slice(2);

  // Check for help flag
  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
  }

  // Parse optional --keypair flag
  let keypairPath = DEFAULT_KEYPAIR_PATH;
  const keypairIndex = args.findIndex((arg) => arg === "--keypair" || arg === "-k");
  if (keypairIndex !== -1 && args[keypairIndex + 1]) {
    keypairPath = args[keypairIndex + 1];
    args.splice(keypairIndex, 2);
  }

  // Validate remaining arguments
  if (args.length < 2) {
    console.error("Error: Missing required arguments");
    printUsage();
  }

  const [recipient, amountStr] = args;
  const amount = parseFloat(amountStr);

  if (isNaN(amount) || amount <= 0) {
    console.error(`Error: Invalid amount "${amountStr}"`);
    process.exit(1);
  }

  // Validate recipient address format
  try {
    address(recipient);
  } catch (error) {
    console.error(`Error: Invalid recipient address "${recipient}"`);
    console.error("Solana addresses are base58-encoded and typically 32-44 characters long");
    process.exit(1);
  }

  return { recipient, amount, keypairPath };
}

/**
 * Load a keypair from a JSON file
 */
async function loadKeypair(keypairPath) {
  try {
    const keypairData = JSON.parse(readFileSync(keypairPath, "utf-8"));
    return await createKeyPairSignerFromBytes(new Uint8Array(keypairData));
  } catch (error) {
    console.error(`Error: Failed to load keypair from ${keypairPath}`);
    console.error(`Details: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Status update helper - overwrites current terminal line (if TTY)
 */
function statusUpdate(message) {
  if (process.stdout.isTTY) {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(message);
  } else {
    console.log(message);
  }
}

/**
 * Poll for a specific commitment level
 */
async function waitForCommitment(rpc, signature, targetCommitment, maxAttempts = 60) {
  const commitmentOrder = { processed: 0, confirmed: 1, finalized: 2 };
  const targetLevel = commitmentOrder[targetCommitment];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await rpc.getSignatureStatuses([signature]).send();
      const status = response.value[0];

      if (!status) {
        // Transaction not yet seen by the cluster
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }

      // Check for on-chain errors
      if (status.err) {
        throw new Error(`Transaction failed on-chain: ${JSON.stringify(status.err)}`);
      }

      // Check if we've reached the target commitment level
      const currentLevel = commitmentOrder[status.confirmationStatus];
      if (currentLevel >= targetLevel) {
        return status;
      }
    } catch (error) {
      if (error.message.includes("Transaction failed on-chain")) {
        throw error;
      }
      // Ignore RPC errors and retry
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timeout waiting for ${targetCommitment} commitment`);
}

/**
 * Send transaction and track confirmation through all stages
 */
async function transferWithConfirmation(rpc, sender, recipientAddress, solAmount) {
  const recipient = address(recipientAddress);
  const amountLamports = BigInt(Math.round(solAmount * 1_000_000_000));

  // Build transfer instruction
  const transferInstruction = getTransferSolInstruction({
    source: sender,
    destination: recipient,
    amount: lamports(amountLamports),
  });

  statusUpdate("Building transaction...");

  // Get latest blockhash for transaction
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  // Create and configure transaction message
  let transactionMessage = createTransactionMessage({ version: 0 });
  transactionMessage = setTransactionMessageFeePayerSigner(sender, transactionMessage);
  transactionMessage = setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, transactionMessage);
  transactionMessage = appendTransactionMessageInstruction(transferInstruction, transactionMessage);

  // Sign the transaction
  const signedTransaction = await signTransactionMessageWithSigners(transactionMessage);

  // Get the signature for tracking
  const signature = getSignatureFromTransaction(signedTransaction);

  // Get the wire format (base64 encoded)
  const wireTransaction = getBase64EncodedWireTransaction(signedTransaction);

  statusUpdate("Sending transaction...");

  // Send the transaction
  await rpc.sendTransaction(wireTransaction, { encoding: "base64" }).send();

  statusUpdate("Transaction sent! Waiting for processed...");

  // Wait for processed (transaction included in a block)
  await waitForCommitment(rpc, signature, "processed");

  statusUpdate("Processed! Waiting for confirmed (~400ms)...");

  // Wait for confirmed (66%+ supermajority voted)
  await waitForCommitment(rpc, signature, "confirmed");

  statusUpdate("Confirmed! Waiting for finalized (~6-12s)...");

  // Wait for finalized (31+ confirmed blocks built on top)
  await waitForCommitment(rpc, signature, "finalized");

  statusUpdate("Finalized!");
  console.log(); // New line after status updates

  return signature;
}

/**
 * Main transfer function
 */
async function main() {
  const { recipient, amount, keypairPath } = parseCLIArgs();

  console.log("\nSolana Transfer Tool");
  console.log("====================\n");
  console.log(`Connected to Solana devnet.`);

  // Load sender keypair
  const sender = await loadKeypair(keypairPath);
  const senderAddress = sender.address;

  console.log(`Sender: ${senderAddress}`);
  console.log(`Recipient: ${recipient}`);
  console.log(`Amount: ${amount} SOL\n`);

  // Initialize RPC connection
  const rpc = createSolanaRpc(DEVNET_RPC_URL);

  // Check sender balance
  const balanceResult = await rpc.getBalance(senderAddress).send();
  const balanceLamports = balanceResult.value;
  const balanceSol = Number(balanceLamports) / 1_000_000_000;

  console.log(`Sender balance: ${balanceSol.toFixed(9)} SOL`);

  // Convert amount to lamports
  const amountLamports = BigInt(Math.round(amount * 1_000_000_000));

  // Check for sufficient balance (including transaction fee)
  const estimatedFee = BigInt(5000); // ~0.000005 SOL
  const totalNeeded = amountLamports + estimatedFee;

  if (balanceLamports < totalNeeded) {
    console.error(`\nError: Insufficient balance`);
    console.error(`Available: ${balanceSol.toFixed(9)} SOL`);
    console.error(`Needed: ${(Number(totalNeeded) / 1_000_000_000).toFixed(9)} SOL (including fees)`);
    process.exit(1);
  }

  console.log(); // Spacing before progress updates

  // Send with staged confirmation tracking
  try {
    const signature = await transferWithConfirmation(rpc, sender, recipient, amount);

    console.log("Transaction successful!");
    console.log(`Signature: ${signature}`);
    console.log(`View on Solana Explorer:`);
    console.log(`https://explorer.solana.com/tx/${signature}?cluster=devnet`);

    // Get new balance
    const newBalanceResult = await rpc.getBalance(senderAddress).send();
    const newBalanceSol = Number(newBalanceResult.value) / 1_000_000_000;
    console.log(`\nNew sender balance: ${newBalanceSol.toFixed(9)} SOL\n`);

  } catch (error) {
    console.error("\nTransaction failed:");
    console.error(error.message);
    process.exit(1);
  }
}

// Run the main function
main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
