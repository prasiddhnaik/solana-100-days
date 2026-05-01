# Accounts vs databases (Solana)

Reference from the “compare accounts vs databases” exercise: how typical DB intuition maps (or doesn’t) to Solana’s account model.

## Comparison table

| Concept | Traditional database | Solana accounts |
|--------|----------------------|-----------------|
| **Data location** | Rows in tables on a centralized server | Accounts on a distributed ledger replicated across validators |
| **Schema** | Defined by the DB (SQL DDL, JSON schema, etc.) | Defined by the **owning program**; serialized as **raw bytes** in the account’s `data` field |
| **Access control** | App auth, DB roles, middleware | **Runtime rules**: only the owning program may modify an account’s data; instructions must carry **required signers** |
| **Cost of storage** | Hosting / disk, often bundled in infra pricing | **Rent-exempt minimum** deposit in lamports, scales with **data size** (`solana rent <bytes>`); **refundable** when the account is closed |
| **Identity / keys** | Auto-increment IDs, UUIDs, natural keys | **32-byte public keys** or **PDAs** (program-derived, deterministic off seeds) |
| **Reads** | SQL, queries, ORMs | **RPC**: `getAccountInfo`, `getProgramAccounts`, etc.; you assemble “views” off-chain |
| **Writes** | `INSERT` / `UPDATE` from application code | **Transactions** containing **instructions**; authorized **signatures** |
| **Code vs data** | App server + DB are separate | **Same abstraction**: **executable** accounts (programs) and **data** accounts share the account model |
| **Deletion** | `DELETE` removes the row | **Close** the account; remaining lamports go to a recipient you specify |
| **Visibility** | Private by default; you expose what you choose | **Public by default**; anyone can read Lamports, owner, executable flag, and data |

## Mental model shifts

- **No JOINs**: accounts don’t “query” each other. Programs receive a fixed account list per instruction; aggregations and filters are **off-chain** (indexers, your backend, RPC).
- **Transparency**: reading chain state is like everyone having **read-only replica access** to every “row,” without asking the operator.

## Rent-exempt minimums (example)

From `solana rent` on devnet (subject to network parameters):

| Data size (bytes) | Rent-exempt minimum (approx.) |
|-------------------|-------------------------------|
| 0 | 0.00089088 SOL |
| 100 | 0.00158688 SOL |
| 1000 | 0.00785088 SOL |

## CLI practice (devnet)

Configured RPC:

```bash
solana config set --url https://api.devnet.solana.com
```

Useful inspections (airdrop if needed: `solana airdrop 1` or `2`):

```bash
solana address
solana account "$(solana address)"
solana account TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
solana rent 0
solana rent 100
solana rent 1000
```

**Wallet (system-owned) account:** balance in lamports, **owner** = System Program `11111111111111111111111111111111`, **executable: false**. A plain SOL wallet is a system account with **no app-defined data** (conceptually 0 bytes of program-specific payload).

**Token program account:** **executable: true**, **owner** = upgradeable BPF loader `BPFLoaderUpgradeab1e11111111111111111111111`; holds **program bytecode** (not your app’s “user table” row).

## Explorer

Paste any pubkey into [Solana Explorer](https://explorer.solana.com/?cluster=devnet) (set cluster to **devnet**) to match CLI fields and browse history.

## Resources

- [Solana Accounts](https://solana.com/docs/core/accounts)
- [Solana CLI](https://solana.com/docs/intro/installation)
