import { web3 } from '@coral-xyz/anchor';

// Program ID
export const COUNTER_HOOK_PROGRAM_ID = new web3.PublicKey('GwLhrTbEzTY91MphjQyA331P63yQDq31Frw5uvZ1umdQ');

// Instruction discriminators (matching our native program)
export const INITIALIZE_MINT_TRADE_COUNTER_DISCRIMINATOR = [1, 2, 3, 4, 5, 6, 7, 8];
export const UPDATE_MINT_TRADE_COUNTER_DISCRIMINATOR = [9, 10, 11, 12, 13, 14, 15, 16];
export const EXECUTE_TRANSFER_HOOK_DISCRIMINATOR = [120, 157, 67, 141, 88, 144, 143, 220];

/**
 * Create instruction to initialize a mint trade counter
 */
export function createInitializeMintTradeCounterInstruction(
    mint: web3.PublicKey,
    mintTradeCounter: web3.PublicKey,
    payer: web3.PublicKey,
    systemProgram: web3.PublicKey = new web3.PublicKey('11111111111111111111111111111111')
): any {
    const keys = [
        { pubkey: mintTradeCounter, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: systemProgram, isSigner: false, isWritable: false },
    ];

    const data = Buffer.from(INITIALIZE_MINT_TRADE_COUNTER_DISCRIMINATOR);

    return {
        keys,
        programId: COUNTER_HOOK_PROGRAM_ID,
        data,
    };
}

/**
 * Create instruction to update a mint trade counter
 */
export function createUpdateMintTradeCounterInstruction(
    mintTradeCounter: web3.PublicKey,
    amount: number | bigint,
    sourceOwner: web3.PublicKey,
    destinationOwner: web3.PublicKey
): any {
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

    return {
        keys,
        programId: COUNTER_HOOK_PROGRAM_ID,
        data,
    };
}

/**
 * Create instruction to execute transfer hook (custom call)
 */
export function createExecuteTransferHookInstruction(
    sourceToken: web3.PublicKey,
    mint: web3.PublicKey,
    destinationToken: web3.PublicKey,
    owner: web3.PublicKey,
    extraAccountMetaList: web3.PublicKey,
    mintTradeCounter: web3.PublicKey,
    amount: number | bigint
): any {
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

    return {
        keys,
        programId: COUNTER_HOOK_PROGRAM_ID,
        data,
    };
}

/**
 * Helper to get the mint trade counter PDA
 */
export function getMintTradeCounterPDA(mint: web3.PublicKey): [web3.PublicKey, number] {
    const [pda, bump] = web3.PublicKey.findProgramAddressSync([
        Buffer.from('mint-trade-counter'),
        mint.toBuffer(),
    ], COUNTER_HOOK_PROGRAM_ID);
    return [pda, bump];
}

/**
 * Helper to get the extra account meta list PDA
 */
export function getExtraAccountMetaListPDA(mint: web3.PublicKey): [web3.PublicKey, number] {
    const [pda, bump] = web3.PublicKey.findProgramAddressSync([
        Buffer.from('extra-account-metas'),
        mint.toBuffer(),
    ], COUNTER_HOOK_PROGRAM_ID);
    return [pda, bump];
}