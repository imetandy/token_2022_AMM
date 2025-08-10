![Token-2022 AMM – Fishing Theme](images/amm_fishing.png)

## Token‑2022 AMM with Transfer Hooks

Build and trade Token‑2022 tokens with active Transfer Hooks on Solana. 

- **Live demo**: [`token-2022-amm.vercel.app`](https://token-2022-amm.vercel.app/)
- **Network**: Devnet

## What’s included

- UI to:
  - **Create a Token‑2022 mint with a Transfer Hook**
  - **Create an LP pool** (tokenA/tokenB)
  - **Add liquidity** and **trade** between the two tokens
- Source code for three on‑chain programs and a Next.js app
- Example whitelisted hook (counter) that updates per‑mint stats on every transfer

---

## Architecture

Three‑program design to keep responsibilities clear and security tight:

- **`token_setup`**: Creates Token‑2022 mints with the Transfer Hook extension and initializes the Extra Account Meta List (EAML) so the hook can resolve its PDAs at runtime.
  - Program ID: `Ba93wuicukbNB6djDoUkvMpDUxTw4Gzo3VH1oLfq9HBp`
- **`counter_hook`**: Minimal, safe Transfer Hook that tracks per‑mint counters (outgoing transfers/volume, last updated). It uses EAML to find the `mint-trade-counter` PDA and updates it during `Execute`.
  - Program ID: `4476u1WA3X8iHbLnhKsmRVTBp4cynRMopq9WB8nSs3M9`
- **`amm`**: Constant‑product AMM that supports Token‑2022. All pool transfers are performed via the Token‑2022 program and include the whitelisted hook program accounts, ensuring hook execution.
  - Program ID: `H7dswT3BXcCEeVjjLWkfpBP2p5imuJy7Qaq9i5VCpoos`


## How it works (high‑level flow)

1. Create two Token‑2022 mints with the Transfer Hook extension pointing to `counter_hook` and initialize EAML for each mint.
2. Create an AMM and a pool for the pair; the pool authority holds the vault ATAs under Token‑2022.
3. Add liquidity to initialize reserves.
4. Trade A↔B: swaps route through Token‑2022 with the whitelisted hook accounts attached, so hooks execute on every transfer.

---

## Frontend (Next.js)

Located in `app/`. The UI guides you through the full flow:

1. Connect wallet (Devnet)
2. Mint Fish A & B (Token‑2022 mints with the hook)
3. Create Pond (AMM + Pool)
4. Add liquidity
5. Trade

Start locally:

```bash
cd app
yarn install
yarn dev
# open http://localhost:3000
```

Program IDs and network are configured in `app/app/config/program.ts`.

---

## On‑chain programs

- `programs/token_setup/`
  - Instruction: `create_token_with_hook(name, symbol, uri)` – creates a Token‑2022 mint with Transfer Hook enabled and initializes the EAML with a `mint-trade-counter` seed.
  - Instruction: `mint_tokens(amount)` – simple minting helper for demos.

- `programs/counter_hook/`
  - Handles `TransferHookInstruction::Execute` to update the per‑mint counter PDA resolved via EAML.
  - Also provides helpers to initialize the counter and EAML PDAs when needed.

- `programs/amm/`
  - Instructions: `create_amm`, `create_pool`, `deposit_liquidity`, `swap`
  - Uses Token‑2022 PDAs/ATAs and always includes whitelisted hook program accounts in transfer CPIs.

---

## Deployment notes

This repo is configured for Devnet. If you redeploy programs:

1. Build and deploy with Anchor.
2. Update program IDs in `app/app/config/program.ts`.
3. Restart the Next.js app and reload.

---

## Roadmap / Extensions

- Support multiple hook programs per mint and per pool
- Permissionless but safe hook‑approval registry
- Integration adapters for existing AMMs (Raydium/Orca/Meteora)
- Pre‑transfer simulation to pre‑validate hook execution paths

---

## Repository structure

```
token_2022_AMM/
├─ programs/
│  ├─ amm/
│  ├─ token_setup/
│  └─ counter_hook/
├─ app/                  # Next.js UI & SDK utils
│  └─ app/
│     ├─ components/
│     ├─ config/
│     ├─ types/
│     └─ utils/
└─ images/
```
