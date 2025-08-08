import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { getBestRpcEndpoint } from '../config/rpc-config';

export async function fundKeypairWithSOL(keypair: Keypair, amount: number = 1): Promise<boolean> {
  try {
    const connection = new Connection(getBestRpcEndpoint(), 'confirmed');
    
    console.log(`Funding keypair ${keypair.publicKey.toString()} with ${amount} SOL...`);
    
    // Request airdrop
    const signature = await connection.requestAirdrop(
      keypair.publicKey,
      amount * LAMPORTS_PER_SOL
    );
    
    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    
    const balance = await connection.getBalance(keypair.publicKey);
    console.log(`Successfully funded! New balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    return true;
  } catch (error) {
    console.error('Error funding keypair:', error);
    return false;
  }
}

export async function checkSOLBalance(publicKey: PublicKey): Promise<number> {
  try {
    const connection = new Connection(getBestRpcEndpoint(), 'confirmed');
    const balance = await connection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error('Error checking balance:', error);
    return 0;
  }
}

export async function createFundedKeypair(): Promise<Keypair> {
  const keypair = Keypair.generate();
  const funded = await fundKeypairWithSOL(keypair, 2); // Fund with 2 SOL
  
  if (!funded) {
    throw new Error('Failed to fund keypair with SOL');
  }
  
  return keypair;
} 