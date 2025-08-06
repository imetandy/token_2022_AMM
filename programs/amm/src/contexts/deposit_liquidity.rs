use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Token2022, TokenAccount, Mint, mint_to, MintTo},
};
use anchor_spl::token_interface::spl_token_2022;
use anchor_lang::solana_program::instruction::AccountMeta;
use anchor_lang::solana_program::program::invoke;
use std::str::FromStr;
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
        msg!("Depositing liquidity: {} token A, {} token B", amount_a, amount_b);
        
        // Transfer tokens from user to pool
        self.transfer_tokens_to_pool(amount_a, amount_b)?;
        
        // Mint LP tokens to user
        self.mint_lp_tokens(amount_a, amount_b)?;
        
        msg!("Liquidity deposited successfully");
        Ok(())
    }
    
    fn transfer_tokens_to_pool(&self, amount_a: u64, amount_b: u64) -> Result<()> {
        // Transfer token A with transfer hook
        if amount_a > 0 {
            msg!("=== TRANSFER A DEBUG ===");
            msg!("Transferring token A with transfer hook...");
            msg!("Amount: {}", amount_a);
            msg!("User account A: {}", self.user_account_a.key());
            msg!("Mint A: {}", self.mint_a.key());
            msg!("Pool account A: {}", self.pool_account_a.key());
            msg!("User: {}", self.user.key());
            msg!("Extra account meta list A: {}", self.extra_account_meta_list_a.key());
            msg!("Mint trade counter A: {}", self.mint_trade_counter_a.key());
            msg!("Transfer hook program A: {}", self.transfer_hook_program_a.key());
            
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
            
            msg!("=== TRANSFER A ACCOUNT INFOS DEBUG ===");
            msg!("Account infos count: {}", account_infos.len());
            for (i, account_info) in account_infos.iter().enumerate() {
                msg!("Account info {}: {} (writable: {}, signer: {})", 
                     i, account_info.key, account_info.is_writable, account_info.is_signer);
            }
            
            invoke(&transfer_ix, account_infos)?;
            msg!("Token A transfer completed");
        }
        
        // Transfer token B with transfer hook
        if amount_b > 0 {
            msg!("Transferring token B with transfer hook...");
            
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
            msg!("Token B transfer completed");
        }
        
        Ok(())
    }
    
    fn mint_lp_tokens(&self, amount_a: u64, amount_b: u64) -> Result<()> {
        // Calculate LP tokens to mint (simplified calculation)
        let lp_amount = (amount_a + amount_b) / 2; // Simplified for now
        
        let cpi_accounts = MintTo {
            mint: self.lp_mint.to_account_info(),
            to: self.user_lp_account.to_account_info(),
            authority: self.pool_authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            self.token_program.to_account_info(),
            cpi_accounts,
        );
        mint_to(cpi_ctx, lp_amount)?;
        
        Ok(())
    }
} 