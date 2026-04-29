import { address, createSolanaRpc, devnet } from "@solana/kit";

const DEFAULT_ADDRESS = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const targetAddressInput = process.argv[2] ?? process.env.SOLANA_ADDRESS ?? DEFAULT_ADDRESS;

// Connect to devnet, Solana's test network.
const rpc = createSolanaRpc(devnet("https://api.devnet.solana.com"));
const targetAddress = address(targetAddressInput);

// Query the balance, similar to calling a public REST API.
const { value: balanceInLamports } = await rpc.getBalance(targetAddress).send();

// Lamports are Solana's smallest unit. 1 SOL = 1,000,000,000 lamports.
const balanceInSol = Number(balanceInLamports) / 1_000_000_000;

console.log(`Address: ${targetAddress}`);
console.log(`Balance: ${balanceInSol} SOL`);
