import { web3 } from '@coral-xyz/anchor';
type Connection = any;
type Transaction = any;
import { createRpc, getBestRpcEndpoint } from '../config/rpc-config';
import { createTransactionMessage, setTransactionMessageFeePayerSigner, setTransactionMessageLifetimeUsingBlockhash, appendTransactionMessageInstructions, signTransactionMessageWithSigners, sendAndConfirmTransactionFactory } from '@solana/kit';
import type { Address } from '@solana/addresses';

const TOKEN_2022_PROGRAM_ID = new web3.PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');



export class TokenMinting {
  private connection: Connection;
  private rpc = createRpc();

  constructor(connection: Connection) {
    this.connection = connection;
  }



  /**
   * Get the associated token account address for a mint and owner
   */
  private async getAssociatedTokenAddress(mint: web3.PublicKey, owner: web3.PublicKey): Promise<web3.PublicKey> {
    const [associatedTokenAddress] = await web3.PublicKey.findProgramAddress(
      [
        owner.toBuffer(),
        TOKEN_2022_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      new web3.PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
    );
    return associatedTokenAddress;
  }

  /**
   * Check token balance for a user
   */
  async getTokenBalance(mintAddress: string, userWallet: web3.PublicKey): Promise<number> {
    const mintPubkey = new web3.PublicKey(mintAddress);
    const userTokenAccount = await this.getAssociatedTokenAddress(mintPubkey, userWallet);
    
    try {
      // Query balance directly; if ATA does not exist, treat as zero
      const balanceInfo = await this.connection.getTokenAccountBalance(userTokenAccount);
      return balanceInfo.value.uiAmount || 0;
    } catch (error) {
      console.log('Error getting token balance:', error);
      return 0;
    }
  }

  /**
   * Create associated token account for a user
   */
  async createAssociatedTokenAccount(
    mintAddress: string,
    userWallet: web3.PublicKey,
    signTransaction: any
  ): Promise<string> {
    const mintPubkey = new web3.PublicKey(mintAddress);
    const userTokenAccount = await this.getAssociatedTokenAddress(mintPubkey, userWallet);
    
    // Check if account already exists
    const accountInfo = await this.rpc.getAccountInfo(userTokenAccount.toBase58() as unknown as Address).send();
    if (accountInfo.value) {
      console.log(`Token account ${userTokenAccount.toString()} already exists`);
      return userTokenAccount.toString();
    }

    // Create the associated token account instruction
    const createAccountInstruction = {
      programId: new web3.PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
      keys: [
        { pubkey: userWallet, isSigner: true, isWritable: true },
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: userWallet, isSigner: true, isWritable: false },
        { pubkey: mintPubkey, isSigner: false, isWritable: false },
        { pubkey: new web3.PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false },
        { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: new web3.PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false }
      ],
      data: Buffer.from([])
    };

    // Build and send via Kit message pipeline
    const { value: { blockhash, lastValidBlockHeight } } = await this.rpc.getLatestBlockhash().send();
    let message = createTransactionMessage({ version: 0, instructions: [createAccountInstruction as any] } as any) as any;
    message = setTransactionMessageFeePayerSigner(message as any, userWallet as any) as any;
    message = setTransactionMessageLifetimeUsingBlockhash(message as any, { blockhash, lastValidBlockHeight } as any) as any;
    const signed = await signTransactionMessageWithSigners(message as any, {} as any);
    const { createSolanaRpcSubscriptions } = await import('@solana/kit');
    const rpcSubscriptions = createSolanaRpcSubscriptions(getBestRpcEndpoint() as any);
    const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc: this.rpc, rpcSubscriptions } as any);
    const signature = await sendAndConfirm(signed as any, { commitment: 'confirmed', lastValidBlockHeight } as any);
    console.log('Associated token account created with signature:', signature);

    return userTokenAccount.toString();
  }
} 