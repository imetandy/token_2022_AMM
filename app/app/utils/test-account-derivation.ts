import { web3 } from '@coral-xyz/anchor'
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
  const mintA = new web3.PublicKey('ArDjtbinLyUZ2NbTwxDTYhs2r6LAypeSy9JbUeqnxxwu') // Token A from logs
  const mintB = new web3.PublicKey('2bSxQMjRH2uEna4nHLkmvhtUrrKADyFFBkEgit6yzXrL') // Token B from logs
  const userWallet = new web3.PublicKey('4rdwbLWMoVSELLZ4MHrZasiikwUqktKiMaYYCNKySj6K')
  const poolAddress = new web3.PublicKey('y6svJrRo5Zsr3x6c3BCBkbLghqzq4MA6SU2r5QfkjBr')
  const ammProgramId = new web3.PublicKey('H7dswT3BXcCEeVjjLWkfpBP2p5imuJy7Qaq9i5VCpoos')

  console.log('=== Account Derivation Test ===')
  
  // Derive pool authority
  const [poolAuthority] = web3.PublicKey.findProgramAddressSync([
    poolAddress.toBuffer(),
    mintA.toBuffer(),
    mintB.toBuffer(),
    Buffer.from(POOL_AUTHORITY_SEED),
  ], ammProgramId)
  console.log('Pool Authority:', poolAuthority.toString())

  // Derive user accounts using our method
  const [userAccountA] = web3.PublicKey.findProgramAddressSync([
    userWallet.toBuffer(), TOKEN_2022_PROGRAM.toBuffer(), mintA.toBuffer()
  ], ASSOCIATED_TOKEN_PROGRAM)
  console.log('User Account A (our method):', userAccountA.toString())

  const [userAccountB] = web3.PublicKey.findProgramAddressSync([
    userWallet.toBuffer(), TOKEN_2022_PROGRAM.toBuffer(), mintB.toBuffer()
  ], ASSOCIATED_TOKEN_PROGRAM)
  console.log('User Account B (our method):', userAccountB.toString())

  // Derive pool accounts
  const [poolAccountA] = web3.PublicKey.findProgramAddressSync([
    poolAuthority.toBuffer(), TOKEN_2022_PROGRAM.toBuffer(), mintA.toBuffer()
  ], ASSOCIATED_TOKEN_PROGRAM)
  console.log('Pool Account A:', poolAccountA.toString())

  const [poolAccountB] = web3.PublicKey.findProgramAddressSync([
    poolAuthority.toBuffer(), TOKEN_2022_PROGRAM.toBuffer(), mintB.toBuffer()
  ], ASSOCIATED_TOKEN_PROGRAM)
  console.log('Pool Account B:', poolAccountB.toString())

  // Derive transfer hook accounts
  const [extraAccountMetaListA] = web3.PublicKey.findProgramAddressSync([
    Buffer.from(EXTRA_ACCOUNT_METAS_SEED),
    mintA.toBuffer(),
  ], TOKEN_SETUP_PROGRAM)
  console.log('Extra Account Meta List A:', extraAccountMetaListA.toString())

  const [mintTradeCounterA] = web3.PublicKey.findProgramAddressSync([
    Buffer.from(MINT_TRADE_COUNTER_SEED),
    mintA.toBuffer(),
  ], TOKEN_SETUP_PROGRAM)
  console.log('Mint Trade Counter A:', mintTradeCounterA.toString())

  const [extraAccountMetaListB] = web3.PublicKey.findProgramAddressSync([
    Buffer.from(EXTRA_ACCOUNT_METAS_SEED),
    mintB.toBuffer(),
  ], TOKEN_SETUP_PROGRAM)
  console.log('Extra Account Meta List B:', extraAccountMetaListB.toString())

  const [mintTradeCounterB] = web3.PublicKey.findProgramAddressSync([
    Buffer.from(MINT_TRADE_COUNTER_SEED),
    mintB.toBuffer(),
  ], TOKEN_SETUP_PROGRAM)
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