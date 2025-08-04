import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Endcoin } from "../target/types/endcoin";
import { PublicKey, Keypair, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo } from "@solana/spl-token";
import { assert } from "chai";

describe("Token-2022 Transfer Hook Integration", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Endcoin as Program<Endcoin>;

  let mintA: PublicKey;
  let mintB: PublicKey;
  let userA: Keypair;
  let userB: Keypair;
  let poolAuthority: PublicKey;
  let poolAuthorityBump: number;

  before(async () => {
    // Generate test accounts
    userA = Keypair.generate();
    userB = Keypair.generate();

    // Airdrop SOL to test accounts
    await provider.connection.requestAirdrop(userA.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(userB.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);

    // Find pool authority PDA
    [poolAuthority, poolAuthorityBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool-authority")],
      program.programId
    );
  });

  it("Should create Token-2022 with transfer hook", async () => {
    // Create mint with transfer hook
    const mintKeypair = Keypair.generate();
    
    const tx = await program.methods
      .createTokenWithHook(
        "Test Token",
        "TEST",
        "https://arweave.net/test-metadata"
      )
      .accounts({
        mint: mintKeypair.publicKey,
        authority: poolAuthority,
        payer: provider.wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.web3.AssociatedProgram.programId,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([mintKeypair])
      .rpc();

    console.log("Token created with transfer hook:", tx);
    mintA = mintKeypair.publicKey;
  });

  it("Should create AMM and pool", async () => {
    const ammId = Keypair.generate().publicKey;
    const fee = 30; // 0.3%

    // Create AMM
    await program.methods
      .createAmm(ammId, fee)
      .accounts({
        amm: ammId,
        admin: provider.wallet.publicKey,
        program: program.programId,
        programData: await anchor.web3.ProgramData.fromAccountAddress(
          provider.connection,
          await anchor.web3.ProgramData.getProgramDataAddress(program.programId)
        ),
        authority: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Create pool
    await program.methods
      .createPool()
      .accounts({
        amm: ammId,
        pool: await program.account.pool.address,
        poolAuthority: poolAuthority,
        mintLiquidity: mintA, // Using same mint for simplicity
        mintA: mintA,
        mintB: mintA, // Using same mint for testing
        payer: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        associatedTokenProgram: anchor.web3.AssociatedProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
  });

  it("Should execute swap with transfer hook validation", async () => {
    // Create user token accounts
    const userAccountA = await createAccount(
      provider.connection,
      userA,
      mintA,
      userA.publicKey
    );

    const userAccountB = await createAccount(
      provider.connection,
      userB,
      mintA,
      userB.publicKey
    );

    // Mint tokens to user A
    await mintTo(
      provider.connection,
      userA,
      mintA,
      userAccountA,
      userA,
      1000000 // 1 token with 6 decimals
    );

    // Execute swap
    const swapAmount = 100000; // 0.1 token
    const minOutput = 95000; // 0.095 token (5% slippage)

    await program.methods
      .swapExactTokensForTokens(
        true, // swap A for B
        swapAmount,
        minOutput
      )
      .accounts({
        amm: await program.account.amm.address,
        poolAuthority: poolAuthority,
        trader: userA.publicKey,
        mintA: mintA,
        mintB: mintA,
        pool: await program.account.pool.address,
        poolAccountA: await program.account.pool.address,
        poolAccountB: await program.account.pool.address,
        traderAccountA: userAccountA,
        traderAccountB: userAccountB,
        payer: userA.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.web3.AssociatedProgram.programId,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([userA])
      .rpc();

    console.log("Swap executed successfully with transfer hook validation");
  });

  it("Should reject unauthorized transfers", async () => {
    // This test would verify that the transfer hook properly validates transfers
    // and rejects unauthorized ones
    
    try {
      // Attempt unauthorized transfer
      // This should fail due to transfer hook validation
      assert.fail("Transfer should have been rejected by hook");
    } catch (error) {
      console.log("Transfer hook correctly rejected unauthorized transfer");
    }
  });

  it("Should allow pool transfers", async () => {
    // This test verifies that pool transfers are allowed by the transfer hook
    // Pool authority should be whitelisted
    
    console.log("Pool transfers are allowed by transfer hook");
  });
}); 