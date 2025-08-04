# Token-2022 AMM

An automated market maker (AMM) that can trade Token-2022 tokens with transfer hooks on Solana. This solves a basic problem: regular AMMs can't handle tokens with transfer hooks, which limits what you can do with programmable tokens.

## What This Does

Token-2022 tokens can have transfer hooks that run code every time the token moves. Regular AMMs break when they try to trade these tokens because the hooks interfere with the trading process. This AMM is built to work with transfer hooks instead of breaking them.

## Key Features

- Works with Token-2022 tokens that have transfer hooks
- Validates transfers through the hook before allowing trades
- Creates and manages liquidity pools
- Includes a web interface for creating tokens and trading
- Can be extended for compliance requirements (KYC, whitelisting, etc.)

## How It Works

1. **Transfer Hook Program**: Runs validation code on every token transfer
2. **AMM Program**: Handles creating pools and executing swaps
3. **Token Creation**: Makes it easy to create Token-2022 tokens with hooks
4. **Web Interface**: Simple UI for all operations

## Getting Started

### Requirements

- Node.js 18+
- Solana CLI
- Anchor Framework
- A Solana wallet with devnet SOL

### Setup

```bash
# Clone and install
git clone <repository-url>
cd token_2022_amm
npm install

# Build the program
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

### Run the Web Interface

```bash
cd app
npm install
npm run dev
```

Then visit `http://localhost:3000`

## How to Use

### Create a Token with Transfer Hook

1. Connect your wallet
2. Go to "Create Token" tab
3. Enter token details (name, symbol, metadata URI)
4. Click "Create Token with Transfer Hook"
5. Approve the transaction

The token will automatically have a transfer hook that validates all transfers.

### Create a Liquidity Pool

1. Go to "Create Pool" tab
2. Enter two Token-2022 token addresses
3. Set trading fee
4. Provide initial liquidity amount
5. Click "Create Liquidity Pool"

Both tokens must be Token-2022 with transfer hooks that allow pool operations.

### Trade Tokens

1. Go to "Trade" tab
2. Select a pool
3. Choose input and output tokens
4. Enter swap amount
5. Set slippage tolerance
6. Click "Execute Swap"

The swap will validate through transfer hooks before executing.

## Technical Details

### Transfer Hook Code

```rust
pub fn process_transfer_hook(
    &self,
    amount: u64,
    source_owner: Pubkey,
    destination_owner: Pubkey,
) -> Result<()> {
    // Basic validation
    if amount == 0 {
        return Err(TransferHookError::InvalidAmount.into());
    }
    
    // Allow pool transfers
    if self.is_pool_account(destination_owner) || self.is_pool_account(source_owner) {
        return Ok(());
    }
    
    // Add your custom validation here
    // - KYC checks
    // - Whitelist validation
    // - Rate limiting
    // - Geographic restrictions
    
    Ok(())
}
```

### How AMM Integration Works

1. Before a swap, the AMM checks if the transfer is allowed
2. Pool accounts are automatically approved for transfers
3. All transfers go through hook validation
4. The swap only executes if validation passes

### Adding Custom Validation

To add your own validation logic:

1. Modify `process_transfer_hook` in `transfer_hook.rs`
2. Add new error types to `TransferHookError`
3. Implement your validation
4. Test with the provided tests

## Testing

```bash
# Run all tests
anchor test

# Run specific test
anchor test token-2022-integration

# Run with verbose output
anchor test -- --nocapture
```

Tests cover:
- Token creation with hooks
- Pool creation and management
- Swap execution with validation
- Rejecting unauthorized transfers
- Allowing pool transfers

## Security

### Transfer Hook Security
- All transfers are validated before execution
- Pool authorities are automatically approved
- Easy to add custom validation logic
- All transfers are logged and traceable

### AMM Security
- Uses program-derived addresses for authorities
- Checks pool integrity
- Prevents front-running with slippage protection
- Validates fee calculations

## Deployment

### Devnet
```bash
solana config set --url devnet
anchor deploy --provider.cluster devnet
```

### Mainnet
```bash
solana config set --url mainnet-beta
anchor deploy --provider.cluster mainnet-beta
```

## Program Instructions

- `create_token_with_hook`: Create Token-2022 with transfer hook
- `create_amm`: Create AMM instance
- `create_pool`: Create liquidity pool
- `swap_exact_tokens_for_tokens`: Execute token swap
- `transfer_hook`: Process transfer hook validation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License 