# Token-2022 AMM Frontend

A Next.js frontend for interacting with the Token-2022 AMM program on Solana devnet.

## Features

- **Token Creation**: Create Token-2022 tokens with transfer hooks
- **Pool Creation**: Create AMM pools for token pairs
- **Liquidity Provision**: Add liquidity to enable trading
- **Token Swapping**: Execute swaps with transfer hook validation
- **Transaction Tracking**: View transaction signatures and program logs
- **Solana Explorer Integration**: Direct links to view transactions on Solana Explorer

## Demo Setup

This frontend is configured for **demo/testing purposes** and includes:

- **Auto-funded Keypairs**: Each operation automatically creates and funds keypairs with devnet SOL
- **Devnet Integration**: All transactions are executed on Solana devnet
- **Real Program Interaction**: Connects to the actual deployed AMM program

### Demo Behavior

- **Token Creation**: Creates funded keypairs and mints Token-2022 tokens with transfer hooks
- **Pool Creation**: Uses funded keypairs to create AMM and pool instances
- **Liquidity**: Adds liquidity using funded keypairs
- **Trading**: Executes swaps with funded keypairs

> **Note**: In a production environment, you would use the connected wallet instead of generated keypairs.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### 1. Connect Wallet
- Connect your Solana wallet (Phantom, Solflare, etc.)
- Make sure you're connected to **Devnet**
- The wallet connection is used for UI state management

### 2. Create Tokens
- Enter token names and symbols for both tokens
- Click "Create Token" to mint Token-2022 tokens with transfer hooks
- The system will automatically create and fund keypairs for the operation
- View transaction results and program logs

### 3. Create Pool
- After creating both tokens, click "Create Pool"
- This creates an AMM and liquidity pool for the token pair
- Uses funded keypairs for the transaction
- View transaction results and program logs

### 4. Add Liquidity
- Enter amounts for both tokens
- Click "Add Liquidity" to provide initial liquidity
- This enables trading on the pool
- Uses funded keypairs for the transaction

### 5. Trade Tokens
- Select swap direction (Token 1 ↔ Token 2)
- Enter the amount to swap
- Click "Execute Swap" to perform the trade
- Uses funded keypairs for the transaction
- View transaction results and program logs

## Transaction Features

### Transaction Signatures
- All transactions display their signature
- Click "View on Explorer" to see the transaction on Solana Explorer
- Signatures are shortened for display but full signatures are shown in logs

### Program Logs
- View all program logs for each transaction
- AMM program logs are highlighted separately
- Logs show the complete transaction execution flow

### Error Handling
- Failed transactions show detailed error messages
- Program-specific errors are displayed clearly
- All errors are logged to the browser console

## Technical Details

### Program Integration
- Connects to the Token-2022 AMM program on devnet
- Program ID: `GYLAVXZXgZ22Bs9oGKnvTbc3AgxRFykABC5x6QzzLiYL`
- Uses Solana Web3.js and SPL Token libraries

### Transfer Hooks
- All tokens created have transfer hooks enabled
- Pool operations are automatically whitelisted
- Enhanced security through programmable token validation

### Network Configuration
- Configured for Solana Devnet
- RPC Endpoint: `https://api.devnet.solana.com`
- Uses confirmed commitment level for transactions

### Demo Keypair Management
- **Auto-funding**: Keypairs are automatically funded with 2 SOL from devnet
- **Balance Checking**: All operations check for sufficient SOL before executing
- **Error Handling**: Clear error messages for insufficient funds

## Development

### Project Structure
```
app/
├── components/          # React components
│   ├── TokenCreationForm.tsx
│   ├── PoolCreationForm.tsx
│   ├── LiquidityForm.tsx
│   ├── TradingInterface.tsx
│   ├── TransactionResult.tsx
│   └── WalletConnectButton.tsx
├── utils/              # Utility functions
│   ├── amm-client.ts   # AMM program client
│   ├── transaction-utils.ts
│   └── devnet-utils.ts # Devnet funding utilities
├── config/             # Configuration
│   └── program.ts      # Program constants
└── types/              # TypeScript types
    └── token_2022_amm.ts
```

### Key Components

- **AMMClient**: Handles all on-chain interactions with the AMM program
- **TransactionResult**: Displays transaction results with signatures and logs
- **Transaction Utils**: Utilities for transaction handling and formatting
- **Devnet Utils**: Utilities for funding keypairs with devnet SOL

### Customization

To customize the frontend:

1. Update program configuration in `config/program.ts`
2. Modify transaction handling in `utils/amm-client.ts`
3. Update UI components in the `components/` directory
4. Add new features by extending the AMMClient class

### Production Setup

To use this in production:

1. Replace `createFundedKeypair()` calls with wallet integration
2. Use the connected wallet's public key and signer
3. Remove devnet funding utilities
4. Add proper error handling for wallet transactions

## Troubleshooting

### Common Issues

1. **Wallet Connection**: Ensure your wallet is connected to devnet
2. **Transaction Failures**: Check the program logs for specific error messages
3. **Network Issues**: Verify RPC endpoint connectivity
4. **Funding Failures**: Devnet airdrops may be rate-limited

### Debug Information

- All transactions are logged to the browser console
- Program logs show detailed execution information
- Transaction signatures can be used to debug on Solana Explorer
- Funding operations are logged with keypair addresses

## Security Notes

- This is a **development/demo application**
- Always verify transaction details before signing
- Never share private keys or seed phrases
- Use test wallets for development purposes
- Demo keypairs are generated for testing only 