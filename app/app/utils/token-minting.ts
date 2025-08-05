import { Connection, PublicKey, Transaction } from '@solana/web3.js';

const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');



export class TokenMinting {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }



  /**
   * Get the associated token account address for a mint and owner
   */
  private async getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): Promise<PublicKey> {
    const [associatedTokenAddress] = await PublicKey.findProgramAddress(
      [
        owner.toBuffer(),
        TOKEN_2022_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
    );
    return associatedTokenAddress;
  }

  /**
   * Check token balance for a user
   */
  async getTokenBalance(mintAddress: string, userWallet: PublicKey): Promise<number> {
    const mintPubkey = new PublicKey(mintAddress);
    const userTokenAccount = await this.getAssociatedTokenAddress(mintPubkey, userWallet);
    
    try {
      // First check if the token account exists
      const accountInfo = await this.connection.getAccountInfo(userTokenAccount);
      if (!accountInfo) {
        console.log(`Token account ${userTokenAccount.toString()} does not exist for mint ${mintAddress}`);
        return 0;
      }
      
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
    userWallet: PublicKey,
    signTransaction: any
  ): Promise<string> {
    const mintPubkey = new PublicKey(mintAddress);
    const userTokenAccount = await this.getAssociatedTokenAddress(mintPubkey, userWallet);
    
    // Check if account already exists
    const accountInfo = await this.connection.getAccountInfo(userTokenAccount);
    if (accountInfo) {
      console.log(`Token account ${userTokenAccount.toString()} already exists`);
      return userTokenAccount.toString();
    }

    // Create the associated token account instruction
    const createAccountInstruction = {
      programId: new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
      keys: [
        { pubkey: userWallet, isSigner: true, isWritable: true },
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: userWallet, isSigner: true, isWritable: false },
        { pubkey: mintPubkey, isSigner: false, isWritable: false },
        { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false },
        { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false }
      ],
      data: Buffer.from([])
    };

    const transaction = new Transaction();
    transaction.add(createAccountInstruction);

    // Get the latest blockhash
    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userWallet;

    console.log('Creating associated token account...');
    
    // Sign and send the transaction
    const signedTx = await signTransaction(transaction);
    const signature = await this.connection.sendRawTransaction(signedTx.serialize());
    console.log('Associated token account created with signature:', signature);

    // Wait for confirmation
    const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
    console.log('Transaction confirmed:', confirmation);

    return userTokenAccount.toString();
  }
} 