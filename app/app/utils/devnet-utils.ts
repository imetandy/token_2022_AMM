import { PublicKey } from './kit';
type Connection = any;
type Keypair = any;
const LAMPORTS_PER_SOL = 1_000_000_000;
import { createRpc } from '../config/rpc-config';

export async function fundKeypairWithSOL(keypair: Keypair, amount: number = 1): Promise<boolean> {
  try {
    const rpc = createRpc();
    
    console.log(`Funding keypair ${keypair.address} with ${amount} SOL...`);
    
    // Request airdrop
    const signature = await rpc
      .requestAirdrop(keypair.address, BigInt(amount * LAMPORTS_PER_SOL) as any)
      .send();
    
    // Wait for confirmation via signature statuses
    let confirmed = false;
    for (let i = 0; i < 30 && !confirmed; i++) {
      const { value: statuses } = await rpc.getSignatureStatuses([signature]).send();
      const status = statuses[0];
      confirmed = !!status && (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized');
      if (!confirmed) await new Promise(r => setTimeout(r, 500));
    }
    
    const { value: balance } = await rpc.getBalance(keypair.address).send();
    console.log(`Successfully funded! New balance: ${Number(balance) / LAMPORTS_PER_SOL} SOL`);
    
    return true;
  } catch (error) {
    console.error('Error funding keypair:', error);
    return false;
  }
}

export async function checkSOLBalance(publicKey: PublicKey): Promise<number> {
  try {
    const rpc = createRpc();
    const { value: balance } = await rpc.getBalance(publicKey as any).send();
    return Number(balance) / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error('Error checking balance:', error);
    return 0;
  }
}

export async function createFundedKeypair(): Promise<Keypair> {
  const { generateKeyPairSigner } = await import('@solana/kit');
  const keypair = await generateKeyPairSigner();
  const funded = await fundKeypairWithSOL(keypair, 2); // Fund with 2 SOL
  
  if (!funded) {
    throw new Error('Failed to fund keypair with SOL');
  }
  
  return keypair;
} 