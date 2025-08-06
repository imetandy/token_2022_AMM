import { PublicKey, TransactionInstruction } from '@solana/web3.js';

// Program ID
export const COUNTER_HOOK_PROGRAM_ID = new PublicKey('GwLhrTbEzTY91MphjQyA331P63yQDq31Frw5uvZ1umdQ');

// Instruction discriminators (matching our native program)
export const INITIALIZE_MINT_TRADE_COUNTER_DISCRIMINATOR = [1, 2, 3, 4, 5, 6, 7, 8];
export const UPDATE_MINT_TRADE_COUNTER_DISCRIMINATOR = [9, 10, 11, 12, 13, 14, 15, 16];
export const EXECUTE_TRANSFER_HOOK_DISCRIMINATOR = [120, 157, 67, 141, 88, 144, 143, 220];

/**
 * Create instruction to initialize a mint trade counter
 */
export function createInitializeMintTradeCounterInstruction(
    mint: PublicKey,
    mintTradeCounter: PublicKey,
    payer: PublicKey,
    systemProgram: PublicKey = new PublicKey('11111111111111111111111111111111')
): TransactionInstruction {
    const keys = [
        { pubkey: mintTradeCounter, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: systemProgram, isSigner: false, isWritable: false },
    ];

    const data = Buffer.from(INITIALIZE_MINT_TRADE_COUNTER_DISCRIMINATOR);

    return new TransactionInstruction({
        keys,
        programId: COUNTER_HOOK_PROGRAM_ID,
        data,
    });
}

/**
 * Create instruction to update a mint trade counter
 */
export function createUpdateMintTradeCounterInstruction(
    mintTradeCounter: PublicKey,
    amount: number | bigint,
    sourceOwner: PublicKey,
    destinationOwner: PublicKey
): TransactionInstruction {
    const keys = [
        { pubkey: mintTradeCounter, isSigner: false, isWritable: true },
    ];

    const amountBuffer = Buffer.alloc(8);
    amountBuffer.writeBigUInt64LE(BigInt(amount), 0);
    
    const sourceOwnerBuffer = sourceOwner.toBytes();
    const destinationOwnerBuffer = destinationOwner.toBytes();
    
    const data = Buffer.concat([
        Buffer.from(UPDATE_MINT_TRADE_COUNTER_DISCRIMINATOR),
        amountBuffer,
        sourceOwnerBuffer,
        destinationOwnerBuffer,
    ]);

    return new TransactionInstruction({
        keys,
        programId: COUNTER_HOOK_PROGRAM_ID,
        data,
    });
}

/**
 * Create instruction to execute transfer hook (custom call)
 */
export function createExecuteTransferHookInstruction(
    sourceToken: PublicKey,
    mint: PublicKey,
    destinationToken: PublicKey,
    owner: PublicKey,
    extraAccountMetaList: PublicKey,
    mintTradeCounter: PublicKey,
    amount: number | bigint
): TransactionInstruction {
    const keys = [
        { pubkey: sourceToken, isSigner: false, isWritable: false },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: destinationToken, isSigner: false, isWritable: false },
        { pubkey: owner, isSigner: false, isWritable: false },
        { pubkey: extraAccountMetaList, isSigner: false, isWritable: false },
        { pubkey: mintTradeCounter, isSigner: false, isWritable: true },
    ];

    const amountBuffer = Buffer.alloc(8);
    amountBuffer.writeBigUInt64LE(BigInt(amount), 0);
    
    const data = Buffer.concat([
        Buffer.from(EXECUTE_TRANSFER_HOOK_DISCRIMINATOR),
        amountBuffer,
    ]);

    return new TransactionInstruction({
        keys,
        programId: COUNTER_HOOK_PROGRAM_ID,
        data,
    });
}

/**
 * Helper to get the mint trade counter PDA
 */
export function getMintTradeCounterPDA(mint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [
            Buffer.from('mint-trade-counter'),
            mint.toBytes(),
        ],
        COUNTER_HOOK_PROGRAM_ID
    );
}

/**
 * Helper to get the extra account meta list PDA
 */
export function getExtraAccountMetaListPDA(mint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [
            Buffer.from('extra-account-metas'),
            mint.toBytes(),
        ],
        COUNTER_HOOK_PROGRAM_ID
    );
} 