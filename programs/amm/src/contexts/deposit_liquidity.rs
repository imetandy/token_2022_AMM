use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Token2022, TokenAccount, Mint, mint_to, MintTo},
};
use anchor_spl::token_interface::spl_token_2022;
use anchor_lang::solana_program::instruction::AccountMeta;
use anchor_lang::solana_program::program::invoke;

use crate::{
    constants::{POOL_AUTHORITY_SEED, AMM_SEED},
    errors::AmmError,
    state::{Amm, Pool},
};

#[derive(Accounts)]
#[instruction(amount_a: u64, amount_b: u64)]
pub struct DepositLiquidity<'info> {
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
        seeds = [
            amm.key().as_ref(),
            mint_a.key().as_ref(),
            mint_b.key().as_ref(),
        ],
        bump,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// CHECK: Pool authority PDA
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

    pub mint_a: Box<InterfaceAccount<'info, Mint>>,
    pub mint_b: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut)]
    pub pool_account_a: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut)]
    pub pool_account_b: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint_a,
        associated_token::authority = user,
    )]
    pub user_account_a: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint_b,
        associated_token::authority = user,
    )]
    pub user_account_b: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = lp_mint,
        associated_token::authority = user,
    )]
    pub user_lp_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = lp_mint,
        associated_token::authority = pool_authority,
    )]
    pub pool_lp_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut)]
    pub lp_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        constraint = user.is_signer @ AmmError::NotSigner
    )]
    pub user: Signer<'info>,

    /// Solana ecosystem accounts
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token2022>,

    /// Transfer hook accounts for mint A
    /// CHECK: Extra account meta list for mint A
    pub extra_account_meta_list_a: AccountInfo<'info>,

    /// CHECK: Mint trade counter for mint A
    #[account(mut)]
    pub mint_trade_counter_a: AccountInfo<'info>,

    /// Transfer hook accounts for mint B
    /// CHECK: Extra account meta list for mint B
    pub extra_account_meta_list_b: AccountInfo<'info>,

    /// CHECK: Mint trade counter for mint B
    #[account(mut)]
    pub mint_trade_counter_b: AccountInfo<'info>,

    /// CHECK: Transfer hook program for mint A
    pub transfer_hook_program_a: AccountInfo<'info>,

    /// CHECK: Transfer hook program for mint B
    pub transfer_hook_program_b: AccountInfo<'info>,
}

impl<'info> DepositLiquidity<'info> {
    pub fn deposit_liquidity(
        &mut self,
        amount_a: u64,
        amount_b: u64,
    ) -> Result<()> {
        
        // Transfer tokens from user to pool
        self.transfer_tokens_to_pool(amount_a, amount_b)?;
        
        // Mint LP tokens to user
        self.mint_lp_tokens(amount_a, amount_b)?;
        
        Ok(())
    }
    
    fn transfer_tokens_to_pool(&self, amount_a: u64, amount_b: u64) -> Result<()> {
        // Transfer token A with transfer hook
        if amount_a > 0 {
            
            // Create mutable transfer_checked instruction
            let mut transfer_ix = spl_token_2022::instruction::transfer_checked(
                &spl_token_2022::id(),
                &self.user_account_a.key(),
                &self.mint_a.key(),
                &self.pool_account_a.key(),
                &self.user.key(),
                &[&self.user.key()],
                amount_a,
                6,
            ).unwrap();
            
            // Add transfer hook program ID first (required by the guide)
            transfer_ix.accounts.push(AccountMeta::new_readonly(
                self.transfer_hook_program_a.key(),
                false,
            ));
            
            // Add transfer hook accounts for mint A
            transfer_ix.accounts.push(AccountMeta::new_readonly(
                self.extra_account_meta_list_a.key(),
                false,
            ));
            transfer_ix.accounts.push(AccountMeta::new(
                self.mint_trade_counter_a.key(),
                false,
            ));
            
            msg!("=== TRANSFER A INSTRUCTION DEBUG ===");
            msg!("Instruction accounts count: {}", transfer_ix.accounts.len());
            for (i, account) in transfer_ix.accounts.iter().enumerate() {
                msg!("Account {}: {} (writable: {}, signer: {})", 
                     i, account.pubkey, account.is_writable, account.is_signer);
            }
            
            // Invoke the modified instruction
            let account_infos = &[
                self.token_program.to_account_info(),
                self.user_account_a.to_account_info(),
                self.mint_a.to_account_info(),
                self.pool_account_a.to_account_info(),
                self.user.to_account_info(),
                self.transfer_hook_program_a.to_account_info(),
                self.extra_account_meta_list_a.to_account_info(),
                self.mint_trade_counter_a.to_account_info(),
            ];
            
            // Account infos prepared for transfer
            
            invoke(&transfer_ix, account_infos)?;
        }
        
        // Transfer token B with transfer hook
        if amount_b > 0 {
            
            // Create mutable transfer_checked instruction
            let mut transfer_ix = spl_token_2022::instruction::transfer_checked(
                &spl_token_2022::id(),
                &self.user_account_b.key(),
                &self.mint_b.key(),
                &self.pool_account_b.key(),
                &self.user.key(),
                &[&self.user.key()],
                amount_b,
                6,
            ).unwrap();
            
            // Add transfer hook program ID first (required by the guide)
            transfer_ix.accounts.push(AccountMeta::new_readonly(
                self.transfer_hook_program_b.key(),
                false,
            ));
            
            // Add transfer hook accounts for mint B
            transfer_ix.accounts.push(AccountMeta::new_readonly(
                self.extra_account_meta_list_b.key(),
                false,
            ));
            transfer_ix.accounts.push(AccountMeta::new(
                self.mint_trade_counter_b.key(),
                false,
            ));
            
            // Invoke the modified instruction
            let account_infos = &[
                self.token_program.to_account_info(),
                self.user_account_b.to_account_info(),
                self.mint_b.to_account_info(),
                self.pool_account_b.to_account_info(),
                self.user.to_account_info(),
                self.transfer_hook_program_b.to_account_info(),
                self.extra_account_meta_list_b.to_account_info(),
                self.mint_trade_counter_b.to_account_info(),
            ];
            
            invoke(&transfer_ix, account_infos)?;
        }
        
        Ok(())
    }
    
    pub fn mint_lp_tokens(&self, amount_a: u64, amount_b: u64) -> Result<()> {
        // Calculate LP tokens to mint using geometric mean (like the working AMM)
        let lp_amount = if amount_a > 0 && amount_b > 0 {
            // Geometric mean calculation similar to working AMM
            ((amount_a as u128 * amount_b as u128) as f64).sqrt() as u64
        } else {
            (amount_a + amount_b) / 2 // Fallback for edge cases
        };
        
        msg!("=== LP TOKEN MINTING DEBUG ===");
        msg!("LP amount to mint: {}", lp_amount);
        
        // Use the stored bump from the pool state
        let pool_authority_bump = self.pool.pool_authority_bump;
        
        let amm_key = self.amm.key();
        let mint_a_key = self.mint_a.key();
        let mint_b_key = self.mint_b.key();
        
        msg!("=== ACCOUNT KEYS DEBUG ===");
        msg!("AMM key: {}", amm_key);
        msg!("Mint A key: {}", mint_a_key);
        msg!("Mint B key: {}", mint_b_key);
        msg!("Pool authority key: {}", self.pool_authority.key());
        msg!("LP mint key: {}", self.lp_mint.key());
        msg!("User LP account key: {}", self.user_lp_account.key());
        msg!("Pool authority bump: {}", pool_authority_bump);
        
        // Create the signer seeds for the pool authority PDA (must match account constraints exactly)
        let authority_seeds = &[
            amm_key.as_ref(),
            mint_a_key.as_ref(),
            mint_b_key.as_ref(),
            POOL_AUTHORITY_SEED,
            &[pool_authority_bump],
        ];
        let signer_seeds = &[&authority_seeds[..]];
        
        // Verify PDA derivation matches
        let (expected_pool_authority, expected_bump) = Pubkey::find_program_address(
            &[
                amm_key.as_ref(),
                mint_a_key.as_ref(),
                mint_b_key.as_ref(),
                POOL_AUTHORITY_SEED,
            ],
            &crate::ID,
        );
        
        msg!("=== PDA VERIFICATION DEBUG ===");
        msg!("Expected pool authority: {}", expected_pool_authority);
        msg!("Actual pool authority: {}", self.pool_authority.key());
        msg!("Expected bump: {}", expected_bump);
        msg!("Stored bump: {}", pool_authority_bump);
        msg!("PDA matches: {}", expected_pool_authority == self.pool_authority.key());
        msg!("Bump matches: {}", expected_bump == pool_authority_bump);
        
        // Check account properties
        msg!("=== ACCOUNT PROPERTIES DEBUG ===");
        msg!("User LP account owner: {}", self.user_lp_account.owner);
        msg!("Pool authority is_writable: {}", self.pool_authority.is_writable);
        msg!("Pool authority is_signer: {}", self.pool_authority.is_signer);
        msg!("Pool authority owner: {}", self.pool_authority.owner);
        msg!("Token program key: {}", self.token_program.key());
        
        // Mint LP tokens using the same pattern as working AMM
        self.mint_token(
            self.lp_mint.to_account_info(),
            self.user_lp_account.to_account_info(),
            self.pool_authority.to_account_info(),
            lp_amount,
            signer_seeds,
            self.token_program.to_account_info(),
        )?;
        
        Ok(())
    }

    pub fn mint_token(
        &self,
        mint: AccountInfo<'info>, 
        to: AccountInfo<'info>, 
        authority: AccountInfo<'info>, 
        amount: u64, 
        signer_seeds: &[&[&[u8]]; 1], 
        token_program: AccountInfo<'info>
    ) -> Result<()> {
        msg!("=== MINT_TOKEN CPI DEBUG ===");
        msg!("Mint account: {}", mint.key());
        msg!("To account: {}", to.key());
        msg!("Authority account: {}", authority.key());
        msg!("Amount: {}", amount);
        msg!("Token program: {}", token_program.key());
        
        msg!("Mint is_writable: {}", mint.is_writable);
        msg!("To is_writable: {}", to.is_writable);
        msg!("Authority is_writable: {}", authority.is_writable);
        
        msg!("Mint is_signer: {}", mint.is_signer);
        msg!("To is_signer: {}", to.is_signer);
        msg!("Authority is_signer: {}", authority.is_signer);
        
        msg!("Mint owner: {}", mint.owner);
        msg!("To owner: {}", to.owner);
        msg!("Authority owner: {}", authority.owner);
        
        mint_to(
            CpiContext::new_with_signer(
                token_program,
                MintTo {
                    mint,
                    to,
                    authority,
                },
                signer_seeds
            ),
            amount,
        )?;

        Ok(())
    }
} 