# Day 23: Solana Account Explorer

A command-line tool to inspect any Solana account and display its details in a clean, readable format.

## What It Does

This explorer connects to Solana devnet via RPC and fetches comprehensive information about any account:

- **Balance** in SOL and lamports
- **Owner** program (with friendly names for known programs)
- **Executable** flag (program vs data account)
- **Data** preview (hex format, truncated for large accounts)
- **Context-aware insights** based on account type
- **Quick links** to block explorers

## Installation

```bash
cd day-23-account-explorer
npm install
```

## Usage

```bash
node explorer.mjs <ADDRESS>
```

### Examples

```bash
# Inspect the SPL Token Program
node explorer.mjs TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA

# Inspect the System Program
node explorer.mjs 11111111111111111111111111111111

# Inspect Wrapped SOL mint
node explorer.mjs So11111111111111111111111111111111111111112

# Use with your wallet (if using Solana CLI)
node explorer.mjs $(solana address)
```

## Sample Output

### Program Account (Token Program)
```
🔍 Solana Account Explorer

Exploring: TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA

══════════════════════════════════════════════════════════════════════
📊 ACCOUNT SUMMARY
══════════════════════════════════════════════════════════════════════

📝 Public Key:  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
                Toke...Q5DA

💰 Balance:     11.973573357 SOL
                11973573357 lamports

👤 Owner:       BPFLoaderUpgradeab1e11111111111111111111111
                (BPF Upgradeable Loader)
                BPFL...1111

⚡ Executable:  ✅ YES (This is a program)

🏠 Rent Epoch:  18446744073709551615
                (Legacy field - no longer actively used)

📦 Data Size:   0 bytes

══════════════════════════════════════════════════════════════════════
💡 INSIGHTS
══════════════════════════════════════════════════════════════════════

🔧 This is a PROGRAM ACCOUNT
   • Can be invoked by other accounts
   • Contains compiled BPF bytecode
   • Owned by the BPF Loader

══════════════════════════════════════════════════════════════════════
🔗 QUICK LINKS
══════════════════════════════════════════════════════════════════════

Solana Explorer: https://explorer.solana.com/address/TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA?cluster=devnet
Solscan:         https://solscan.io/account/TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA?cluster=devnet
SolanaFM:        https://solana.fm/address/TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA?cluster=devnet-solana
```

### Data Account (Token Mint)
```
📝 Public Key:  So11111111111111111111111111111111111111112
                So11...1112

💰 Balance:     1440.924145107 SOL
                1440924145107 lamports

👤 Owner:       TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
                (Token Program)
                Toke...Q5DA

⚡ Executable:  ❌ NO (This is a data account)

📦 Data Size:   82 bytes

📄 Data Preview:
   [72 bytes total] d7 5d 75 d7 5d 75 d7 5d 75 ... 94 90 bd 44 2e 4b 73 68
         (truncated for display)

💡 INSIGHTS

🪙 This is a TOKEN ACCOUNT
   • Stores token balances (SPL tokens)
   • Has specific data layout (mint, owner, amount, etc.)
   • Owned by Token Program
```

## Key Features

### Known Program Detection
The explorer recognizes and displays friendly names for common programs:
- System Program
- Token Program / Token-2022
- Associated Token Program
- BPF Loader programs
- Stake Program, Vote Program
- And more...

### Account Type Detection
Based on the owner and executable flag, the explorer provides context:
- 🔧 **Program Accounts** - Smart contracts with executable bytecode
- 👛 **Wallet Accounts** - System-owned accounts with just a SOL balance
- 🪙 **Token Accounts** - SPL token data (mints, token accounts)
- 📦 **Data Accounts** - Program-owned storage

### Data Display
- Hex representation of account data
- Automatic truncation for large accounts (shows first 32 bytes + ... + last 8 bytes)
- Accurate size reporting using the `space` field from RPC

## Technology Stack

- **@solana/kit** - Modern Solana JavaScript SDK
- **Node.js** 18+ with ES Modules
- **JSON-RPC** - Direct connection to Solana devnet

## What You Learned

1. **Every account has the same structure** - lamports, data, owner, executable, rentEpoch
2. **Programs are accounts too** - The `executable` flag distinguishes them
3. **Ownership matters** - Only the owning program can modify an account
4. **Native vs BPF programs** - System Program is native; Token Program is BPF bytecode
5. **RPC data format** - Understanding how @solana/kit returns account data (base64 strings)

## Resources

- [Solana Accounts Documentation](https://solana.com/docs/core/accounts)
- [getAccountInfo RPC Method](https://solana.com/docs/rpc/http/getaccountinfo)
- [@solana/kit on npm](https://www.npmjs.com/package/@solana/kit)

---

Part of the 100 Days of Solana Challenge 🚀
