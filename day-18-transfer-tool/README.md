# Solana Transfer Tool

A programmatic CLI utility for sending SOL on Solana devnet. Built with the modern `@solana/kit` SDK (formerly web3.js 2.0).

## Features

- ✅ Balance checking before sending
- ✅ Proper error handling with helpful messages
- ✅ Transaction confirmation with Explorer links
- ✅ Custom keypair support
- ✅ Input validation (addresses, amounts)

## Installation

```bash
npm install
```

## Usage

```bash
node transfer.mjs <RECIPIENT_ADDRESS> <AMOUNT>
```

### Examples

Send 0.05 SOL to a recipient:
```bash
node transfer.mjs ZiQrP62RhMmpXSHRauvUCSwSm2zLPrTjVRXrB2akR9D 0.05
```

Send using a custom keypair:
```bash
node transfer.mjs <RECIPIENT> 0.001 --keypair ~/my-keypair.json
```

Show help:
```bash
node transfer.mjs --help
```

## Sample Output

```
Solana Transfer Tool
====================

Connected to Solana devnet.
Sender: 9VjfTLWsP97Are5M38gHtcuishoDSwHHndhVnHVtiwi
Recipient: ZiQrP62RhMmpXSHRauvUCSwSm2zLPrTjVRXrB2akR9D
Amount: 0.001 SOL

Sender balance: 9.498990000 SOL
Building transaction...
Sending transaction...
Transaction sent! Waiting for confirmation...
Signature: 4wMNNfgi2byLCqePH8x6...

Transaction confirmed!
Explorer: https://explorer.solana.com/tx/4wMNNfgi2byLCqePH8x6ACm8r8og4EJXK8RYR9yoUkLD4Hbz9XPwBC6fS9X5hbT4meNLJcjpdvF7vaDXNqFBPGGz?cluster=devnet
New sender balance: 9.497985000 SOL
```

## Error Handling

The tool handles common errors gracefully:

- **Insufficient balance**: Checks balance before sending and shows available vs needed
- **Invalid address**: Validates recipient address format
- **Invalid amount**: Rejects negative or non-numeric amounts
- **Missing arguments**: Shows usage message

## Dependencies

- `@solana/kit` - Modern Solana JavaScript SDK
- `@solana-program/system` - System program instructions

## Requirements

- Node.js v18 or later
- Solana CLI keypair (usually at `~/.config/solana/id.json`)
- Devnet SOL in your wallet

## Getting Devnet SOL

If you need more devnet SOL, get it from the [Solana Faucet](https://faucet.solana.com/).
