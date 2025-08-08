import { PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'
import { 
  TOKEN_2022_PROGRAM, 
  ASSOCIATED_TOKEN_PROGRAM,
  TOKEN_SETUP_PROGRAM,
  POOL_AUTHORITY_SEED,
  EXTRA_ACCOUNT_METAS_SEED,
  MINT_TRADE_COUNTER_SEED
} from '../config/constants'

export function testAccountDerivation() {
  // Test with the actual values from the error
  const mintA = new PublicKey('ArDjtbinLyUZ2NbTwxDTYhs2r6LAypeSy9JbUeqnxxwu') // Token A from logs
  const mintB = new PublicKey('2bSxQMjRH2uEna4nHLkmvhtUrrKADyFFBkEgit6yzXrL') // Token B from logs
  const userWallet = new PublicKey('4rdwbLWMoVSELLZ4MHrZasiikwUqktKiMaYYCNKySj6K')
  const poolAddress = new PublicKey('y6svJrRo5Zsr3x6c3BCBkbLghqzq4MA6SU2r5QfkjBr')
  const ammProgramId = new PublicKey('H7dswT3BXcCEeVjjLWkfpBP2p5imuJy7Qaq9i5VCpoos')

  console.log('=== Account Derivation Test ===')
  
  // Derive pool authority
  const [poolAuthority] = PublicKey.findProgramAddressSync(
    [
      poolAddress.toBuffer(),
      mintA.toBuffer(),
      mintB.toBuffer(),
      Buffer.from(POOL_AUTHORITY_SEED)
    ],
    ammProgramId
  )
  console.log('Pool Authority:', poolAuthority.toString())

  // Derive user accounts using our method
  const userAccountA = getAssociatedTokenAddressSync(
    mintA,
    userWallet,
    true,
    TOKEN_2022_PROGRAM
  )
  console.log('User Account A (our method):', userAccountA.toString())

  const userAccountB = getAssociatedTokenAddressSync(
    mintB,
    userWallet,
    true,
    TOKEN_2022_PROGRAM
  )
  console.log('User Account B (our method):', userAccountB.toString())

  // Derive pool accounts
  const poolAccountA = getAssociatedTokenAddressSync(
    mintA,
    poolAuthority,
    true,
    TOKEN_2022_PROGRAM
  )
  console.log('Pool Account A:', poolAccountA.toString())

  const poolAccountB = getAssociatedTokenAddressSync(
    mintB,
    poolAuthority,
    true,
    TOKEN_2022_PROGRAM
  )
  console.log('Pool Account B:', poolAccountB.toString())

  // Derive transfer hook accounts
  const [extraAccountMetaListA] = PublicKey.findProgramAddressSync(
    [Buffer.from(EXTRA_ACCOUNT_METAS_SEED), mintA.toBuffer()],
    TOKEN_SETUP_PROGRAM
  )
  console.log('Extra Account Meta List A:', extraAccountMetaListA.toString())

  const [mintTradeCounterA] = PublicKey.findProgramAddressSync(
    [Buffer.from(MINT_TRADE_COUNTER_SEED), mintA.toBuffer()],
    TOKEN_SETUP_PROGRAM
  )
  console.log('Mint Trade Counter A:', mintTradeCounterA.toString())

  const [extraAccountMetaListB] = PublicKey.findProgramAddressSync(
    [Buffer.from(EXTRA_ACCOUNT_METAS_SEED), mintB.toBuffer()],
    TOKEN_SETUP_PROGRAM
  )
  console.log('Extra Account Meta List B:', extraAccountMetaListB.toString())

  const [mintTradeCounterB] = PublicKey.findProgramAddressSync(
    [Buffer.from(MINT_TRADE_COUNTER_SEED), mintB.toBuffer()],
    TOKEN_SETUP_PROGRAM
  )
  console.log('Mint Trade Counter B:', mintTradeCounterB.toString())

  console.log('=== Expected vs Actual from Error ===')
  console.log('Expected User Account A: ARYGbDjTVBJ6g1rAotEKdLiDugS7UCMbdF4sLSFMHNjb')
  console.log('Actual User Account A: Dj5KNuB9PW2fgcZKsQpQnFPKDCGNU3eACjpqaWSbjtkG')
  console.log('Our Derived User Account A:', userAccountA.toString())
  
  console.log('=== Comparison ===')
  console.log('Expected matches our derivation:', userAccountA.toString() === 'ARYGbDjTVBJ6g1rAotEKdLiDugS7UCMbdF4sLSFMHNjb')
  console.log('Actual matches our derivation:', userAccountA.toString() === 'Dj5KNuB9PW2fgcZKsQpQnFPKDCGNU3eACjpqaWSbjtkG')

  // Try different derivation methods to see if any match
  console.log('=== Alternative Derivation Methods ===')
  
  // Method 1: Using standard SPL token derivation (not Token-2022)
  const userAccountA_std = getAssociatedTokenAddressSync(
    mintA,
    userWallet,
    false // allowOwnerOffCurve = false
  )
  console.log('User Account A (standard SPL):', userAccountA_std.toString())
  
  // Method 2: Manual PDA derivation
  const [userAccountA_manual] = PublicKey.findProgramAddressSync(
    [
      userWallet.toBuffer(),
      new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL').toBuffer(),
      TOKEN_2022_PROGRAM.toBuffer(),
      mintA.toBuffer(),
    ],
    new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
  )
  console.log('User Account A (manual PDA):', userAccountA_manual.toString())
  
  // Method 3: Using allowOwnerOffCurve = false with Token-2022
  const userAccountA_no_offcurve = getAssociatedTokenAddressSync(
    mintA,
    userWallet,
    false,
    TOKEN_2022_PROGRAM
  )
  console.log('User Account A (no offcurve):', userAccountA_no_offcurve.toString())
} 