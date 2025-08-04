# Token-2022 AMM Types

This directory contains the TypeScript types and IDL for the Token-2022 AMM program.

## Files

- `token_2022_amm.ts` - TypeScript type definitions for the program
- `token_2022_amm.json` - JSON IDL (Interface Definition Language) for the program
- `index.ts` - Export file for easy importing

## Usage

### Importing Types

```typescript
// Import the main program type
import { Token2022Amm } from '../types';

// Import from the program config (recommended)
import { Token2022Amm } from '../config/program';
```

### Using the Types

```typescript
// Example: Creating an AMM instruction
import { Token2022Amm } from '../types';

const createAmmInstruction: Token2022Amm['instructions'][0] = {
  name: 'createAmm',
  discriminator: [242, 91, 21, 170, 5, 68, 125, 64],
  accounts: [
    // ... account definitions
  ],
  args: [
    // ... argument definitions
  ]
};
```

### Available Instructions

The program supports the following instructions:

1. `createAmm` - Create a new AMM
2. `createPool` - Create a new liquidity pool
3. `createTokenAccounts` - Create token accounts for the pool
4. `createTokenWithHook` - Create a Token-2022 with transfer hook
5. `depositLiquidity` - Deposit liquidity into a pool
6. `swapExactTokensForTokens` - Swap tokens
7. `transferHook` - Transfer hook for Token-2022
8. `updateAdmin` - Update AMM admin
9. `updateFee` - Update AMM fee

### Program Address

The program address is: `GYLAVXZXgZ22Bs9oGKnvTbc3AgxRFykABC5x6QzzLiYL`

### Network Configuration

The frontend is configured to use Solana devnet by default.

## Integration with Components

All components in the app have been updated to import and use these types:

- `TokenCreationForm.tsx` - Uses types for token creation
- `PoolCreationForm.tsx` - Uses types for pool creation
- `TradingInterface.tsx` - Uses types for trading operations

## Utility Functions

See `../utils/program-types.ts` for example utility functions that demonstrate how to use the types. 