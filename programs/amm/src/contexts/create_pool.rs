use anchor_lang::prelude::*;

use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        Mint,
        Token2022
    },
};
use crate::{
    constants::{POOL_AUTHORITY_SEED, AMM_SEED},
    errors::*,
    state::{Amm, Pool},
};

impl<'info> CreatePool<'info> {
    pub fn create_pool(&mut self) -> Result<()> {
        let pool = &mut self.pool;
        pool.amm = self.amm.key();
        
        pool.mint_a = self.mint_a.key();
        pool.mint_b = self.mint_b.key();
        // Note: vault_a and vault_b will be set when token accounts are created
        pool.vault_a = Pubkey::default(); // Will be set in create_pool_token_accounts
        pool.vault_b = Pubkey::default(); // Will be set in create_pool_token_accounts
        pool.lp_mint = self.mint_liquidity.key();
        pool.total_liquidity = 0;
        
        // Store the pool authority bump for deterministic derivation
        let (_, bump) = Pubkey::find_program_address(
            &[
                self.amm.key().as_ref(),
                self.mint_a.key().as_ref(),
                self.mint_b.key().as_ref(),
                POOL_AUTHORITY_SEED.as_ref(),
            ],
            &crate::ID,
        );
        pool.pool_authority_bump = bump;

        msg!("Pool created successfully");
        msg!("Pool authority bump: {}", bump);
        msg!("LP mint: {}", self.mint_liquidity.key());

        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreatePool<'info> {
    /// The account paying for all rents
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        seeds = [
            AMM_SEED,
            mint_a.key().as_ref(),
            mint_b.key().as_ref(),
        ],
        bump,
    )]
    pub amm: Box<Account<'info, Amm>>,

    #[account(
        init,
        payer = payer,
        space = Pool::LEN,
        seeds = [
            amm.key().as_ref(),
            mint_a.key().as_ref(),
            mint_b.key().as_ref(),
        ],
        bump,
        constraint = mint_a.key() != mint_b.key() @ AmmError::InvalidPool,
    )]
    pub pool: Box<Account<'info, Pool>>,
    
    /// CHECK: Pool authority PDA - doesn't need to be created, just derived
    #[account(
        seeds = [
            amm.key().as_ref(),
            mint_a.key().as_ref(),
            mint_b.key().as_ref(),
            POOL_AUTHORITY_SEED,
        ],
        bump,
    )]
    pub pool_authority: AccountInfo<'info>,

    #[account(
        init,
        signer,
        payer = payer,
        mint::token_program = token_program,
        mint::decimals = 6,
        mint::authority = pool_authority,
        mint::freeze_authority = pool_authority,
    )]
    pub mint_liquidity: Box<InterfaceAccount<'info, Mint>>,

    pub mint_a: Box<InterfaceAccount<'info, Mint>>,

    pub mint_b: Box<InterfaceAccount<'info, Mint>>,



    /// Solana ecosystem accounts
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token2022>,
} 