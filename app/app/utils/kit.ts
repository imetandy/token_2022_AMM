import type { Address } from '@solana/addresses';
import bs58 from 'bs58';
import { PublicKey } from '@solana/web3.js';
import { createSolanaRpc } from '@solana/kit';
import { createRpc } from '../config/rpc-config';

export { createRpc };
export type { Address };

let rpcSingleton: ReturnType<typeof createRpc> | null = null;
export function getRpc() {
  if (!rpcSingleton) rpcSingleton = createRpc();
  return rpcSingleton;
}

export function toAddress(input: PublicKey | string): Address {
  return (typeof input === 'string' ? input : input.toBase58()) as Address;
}

export async function rpcGetLatestBlockhash(): Promise<{ blockhash: string }> {
  const { value } = await getRpc().getLatestBlockhash().send();
  return { blockhash: value.blockhash };
}

export type EncodedAccount = {
  data: [string, 'base64' | 'base58'];
};

export async function rpcGetAccountInfo(address: PublicKey | string) {
  return await getRpc().getAccountInfo(toAddress(address)).send();
}

export function decodeAccountData(account: EncodedAccount | null | undefined): Buffer | null {
  if (!account) return null;
  const [encoded, encoding] = account.data;
  if (encoding === 'base64') return Buffer.from(encoded, 'base64');
  return Buffer.from(bs58.decode(encoded));
}

function toSeedBuffer(seed: string | Uint8Array | PublicKey): Buffer {
  if (typeof seed === 'string') return Buffer.from(seed);
  if (seed instanceof PublicKey) {
    // Prefer toBuffer when available
    const anyPk: any = seed as any;
    if (typeof anyPk.toBuffer === 'function') return anyPk.toBuffer();
    return Buffer.from(bs58.decode(seed.toBase58()));
  }
  return Buffer.from(seed);
}

export function derivePdaAddressSync(
  seeds: Array<string | Uint8Array | PublicKey>,
  programAddressBase58: string
): PublicKey {
  const [pda] = (PublicKey as any).findProgramAddressSync(
    seeds.map(toSeedBuffer),
    new PublicKey(programAddressBase58)
  );
  return pda as PublicKey;
}

export function deriveAtaAddressSync(params: {
  owner: PublicKey;
  mint: PublicKey;
  tokenProgramAddressBase58: string; // e.g. TOKEN_2022_PROGRAM_ID
  associatedTokenProgramAddressBase58: string; // e.g. ASSOCIATED_TOKEN_PROGRAM_ID
}): PublicKey {
  const { owner, mint, tokenProgramAddressBase58, associatedTokenProgramAddressBase58 } = params;
  return derivePdaAddressSync(
    [owner, bs58.decode(tokenProgramAddressBase58), mint],
    associatedTokenProgramAddressBase58
  );
}

export { PublicKey };

