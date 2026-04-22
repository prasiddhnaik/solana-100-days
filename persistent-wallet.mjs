import {
  createSolanaRpc,
  devnet,
  createKeyPairSignerFromBytes,
} from "@solana/kit";
import { readFile, writeFile } from "node:fs/promises";
import { lamportsToSolString } from "./sol-units.mjs";

const WALLET_FILE = "wallet.json";
const rpc = createSolanaRpc(devnet("https://api.devnet.solana.com"));

async function loadOrCreateWallet() {
  try {
    const data = JSON.parse(await readFile(WALLET_FILE, "utf-8"));
    const secretBytes = new Uint8Array(data.secretKey);
    const wallet = await createKeyPairSignerFromBytes(secretBytes);
    console.log("Loaded existing wallet:", wallet.address);
    return wallet;
  } catch {
    // Generate with extractable: true so we can export the bytes
    const keyPair = await crypto.subtle.generateKey("Ed25519", true, [
      "sign",
      "verify",
    ]);

    // Node.js does not support raw export for Ed25519 private keys.
    // Export as PKCS8 and slice the 32-byte seed from the fixed DER offset (16).
    const pkcs8 = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
    const privateKeyBytes = new Uint8Array(pkcs8).slice(16, 48);

    const publicKeyBytes = new Uint8Array(
      await crypto.subtle.exportKey("raw", keyPair.publicKey)
    );

    // Solana keypair format: 64 bytes (32 private + 32 public)
    const keypairBytes = new Uint8Array(64);
    keypairBytes.set(privateKeyBytes, 0);
    keypairBytes.set(publicKeyBytes, 32);

    await writeFile(
      WALLET_FILE,
      JSON.stringify({ secretKey: Array.from(keypairBytes) })
    );

    // Build signer from the saved bytes
    const wallet = await createKeyPairSignerFromBytes(keypairBytes);
    console.log("Created new wallet:", wallet.address);
    console.log(`Saved to ${WALLET_FILE}`);
    return wallet;
  }
}

const wallet = await loadOrCreateWallet();

const { value: lamports } = await rpc.getBalance(wallet.address).send();
const balanceInSol = lamportsToSolString(lamports);

console.log(`\nAddress: ${wallet.address}`);
console.log(`Balance: ${balanceInSol} SOL`);
console.log(`Lamports: ${lamports}`);

if (BigInt(lamports) === 0n) {
  console.log(
    "\nThis wallet has no SOL. Visit https://faucet.solana.com/ and airdrop some to:"
  );
  console.log(wallet.address);
}
