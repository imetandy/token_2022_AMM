// Utility file to demonstrate and verify the Token-2022 AMM types
import { Token2022Amm } from '../types';

// Example function that uses the program types
export function createAmmInstruction(
  poolId: string,
  solFee: number,
  solFeeCollector: string
): Token2022Amm['instructions'][0] {
  return {
    name: 'createAmm',
    discriminator: [242, 91, 21, 170, 5, 68, 125, 64],
    accounts: [
      {
        name: 'amm',
        writable: true,
        pda: {
          seeds: [
            {
              kind: 'const',
              value: [97, 109, 109]
            },
            {
              kind: 'arg',
              path: 'poolId'
            }
          ]
        }
      },
      {
        name: 'admin',
        docs: ['The admin of the AMM'],
        signer: true
      },
      {
        name: 'solFeeCollector',
        docs: ['SOL fee collector account']
      },
      {
        name: 'authority',
        writable: true,
        signer: true
      },
      {
        name: 'systemProgram',
        address: '11111111111111111111111111111111'
      }
    ],
    args: [
      {
        name: 'poolId',
        type: 'string'
      },
      {
        name: 'solFee',
        type: 'u64'
      },
      {
        name: 'solFeeCollector',
        type: 'pubkey'
      }
    ]
  };
}

// Example function to get program address
export function getProgramAddress(): string {
  return 'GYLAVXZXgZ22Bs9oGKnvTbc3AgxRFykABC5x6QzzLiYL';
}

// Example function to validate instruction name
export function isValidInstruction(instructionName: string): boolean {
  const validInstructions = [
    'createAmm',
    'createPool',
    'createTokenAccounts',
    'createTokenWithHook',
    'depositLiquidity',
    'swapExactTokensForTokens',
    'transferHook',
    'updateAdmin',
    'updateFee'
  ];
  return validInstructions.includes(instructionName);
} 