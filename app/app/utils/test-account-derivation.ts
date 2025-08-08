import { PublicKey, derivePdaAddressSync, deriveAtaAddressSync } from './kit'
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
  const poolAuthority = derivePdaAddressSync([
    poolAddress,
    mintA,
    mintB,
    POOL_AUTHORITY_SEED,
  ], ammProgramId.toBase58())
  console.log('Pool Authority:', poolAuthority.toString())

  // Derive user accounts using our method
  const userAccountA = deriveAtaAddressSync({
    owner: userWallet,
    mint: mintA,
    tokenProgramAddressBase58: TOKEN_2022_PROGRAM.toBase58(),
    associatedTokenProgramAddressBase58: ASSOCIATED_TOKEN_PROGRAM.toBase58(),
  })
  console.log('User Account A (our method):', userAccountA.toString())

  const userAccountB = deriveAtaAddressSync({
    owner: userWallet,
    mint: mintB,
    tokenProgramAddressBase58: TOKEN_2022_PROGRAM.toBase58(),
    associatedTokenProgramAddressBase58: ASSOCIATED_TOKEN_PROGRAM.toBase58(),
  })
  console.log('User Account B (our method):', userAccountB.toString())

  // Derive pool accounts
  const poolAccountA = deriveAtaAddressSync({
    owner: poolAuthority,
    mint: mintA,
    tokenProgramAddressBase58: TOKEN_2022_PROGRAM.toBase58(),
    associatedTokenProgramAddressBase58: ASSOCIATED_TOKEN_PROGRAM.toBase58(),
  })
  console.log('Pool Account A:', poolAccountA.toString())

  const poolAccountB = deriveAtaAddressSync({
    owner: poolAuthority,
    mint: mintB,
    tokenProgramAddressBase58: TOKEN_2022_PROGRAM.toBase58(),
    associatedTokenProgramAddressBase58: ASSOCIATED_TOKEN_PROGRAM.toBase58(),
  })
  console.log('Pool Account B:', poolAccountB.toString())

  // Derive transfer hook accounts
  const extraAccountMetaListA = derivePdaAddressSync([
    EXTRA_ACCOUNT_METAS_SEED,
    mintA,
  ], TOKEN_SETUP_PROGRAM.toBase58())
  console.log('Extra Account Meta List A:', extraAccountMetaListA.toString())

  const mintTradeCounterA = derivePdaAddressSync([
    MINT_TRADE_COUNTER_SEED,
    mintA,
  ], TOKEN_SETUP_PROGRAM.toBase58())
  console.log('Mint Trade Counter A:', mintTradeCounterA.toString())

  const extraAccountMetaListB = derivePdaAddressSync([
    EXTRA_ACCOUNT_METAS_SEED,
    mintB,
  ], TOKEN_SETUP_PROGRAM.toBase58())
  console.log('Extra Account Meta List B:', extraAccountMetaListB.toString())

  const mintTradeCounterB = derivePdaAddressSync([
    MINT_TRADE_COUNTER_SEED,
    mintB,
  ], TOKEN_SETUP_PROGRAM.toBase58())
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
  
  // Method 1: (removed) standard SPL derivation example
  
  // Method 2: Manual PDA derivation
  // Manual derivation example is obsolete under Kit
  
  // Method 3: (removed) off-curve variant example
} 