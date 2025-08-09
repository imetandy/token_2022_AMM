use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Token2022, Mint},
};
use anchor_spl::token_interface::spl_token_2022;
use anchor_lang::solana_program::instruction::AccountMeta;
use anchor_lang::solana_program::program::{invoke, invoke_signed};
use anchor_spl::token_interface::TokenAccount;
use crate::{
    constants::{POOL_AUTHORITY_SEED, AMM_SEED},
    errors::*,
    state::{Amm, Pool},
};

#[derive(Accounts)]
#[instruction(swap_a: bool, input_amount: u64, min_output_amount: u64)]
pub struct Swap<'info> {
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
            pool.key().as_ref(),
            mint_a.key().as_ref(),
            mint_b.key().as_ref(),
            POOL_AUTHORITY_SEED,
        ],
        bump = pool.pool_authority_bump,
    )]
    pub pool_authority: AccountInfo<'info>,

    pub mint_a: Box<InterfaceAccount<'info, Mint>>,
    pub mint_b: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut,
        associated_token::mint = mint_a,
        associated_token::authority = pool_authority,
        associated_token::token_program = token_program,
    )]
    pub pool_account_a: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut,
        associated_token::mint = mint_b,
        associated_token::authority = pool_authority,
        associated_token::token_program = token_program,
    )]
    pub pool_account_b: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut,
        associated_token::mint = mint_a,
        associated_token::authority = user,
        associated_token::token_program = token_program,
    )]
    pub user_account_a: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut,
        associated_token::mint = mint_b,
        associated_token::authority = user,
        associated_token::token_program = token_program,
    )]
    pub user_account_b: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
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

impl<'info> Swap<'info> {
    pub fn swap(
        &mut self,
        swap_a: bool,
        input_amount: u64,
        min_output_amount: u64,
        _bumps: &SwapBumps,
    ) -> Result<()> {
        msg!("Swapping {} tokens", input_amount);
        msg!("Swap direction: {}", if swap_a { "A to B" } else { "B to A" });

        // Calculate output amount (simplified constant product formula)
        let output_amount = self.calculate_output_amount(swap_a, input_amount)?;
        
        // Check slippage
        require!(output_amount >= min_output_amount, AmmError::SlippageExceeded);
        
        // Execute the swap
        self.execute_swap(swap_a, input_amount, output_amount)?;
        
        msg!("Swap completed successfully. Output: {}", output_amount);
        Ok(())
    }
    

        
    fn calculate_output_amount(&self, swap_a: bool, input_amount: u64) -> Result<u64> {
        // Get current reserves from pool accounts as u128 to avoid overflow
        let reserve_a = self.pool_account_a.amount as u128;
        let reserve_b = self.pool_account_b.amount as u128;

        // Simplified constant product formula: (x + dx) * (y - dy) = x * y
        // where dx is input_amount and dy is output_amount
        let (reserve_in, reserve_out) = if swap_a {
            (reserve_a, reserve_b)
        } else {
            (reserve_b, reserve_a)
        };

        // Guard against empty reserves
        require!(reserve_in > 0 && reserve_out > 0, AmmError::InsufficientLiquidity);

        let input = input_amount as u128;
        let numerator = input.checked_mul(reserve_out).ok_or_else(|| error!(AmmError::InvalidAmount))?;
        let denominator = reserve_in.checked_add(input).ok_or_else(|| error!(AmmError::InvalidAmount))?;
        let output_u128 = numerator.checked_div(denominator).ok_or_else(|| error!(AmmError::InvalidAmount))?;

        // Ensure result fits in u64
        if output_u128 > u64::MAX as u128 {
            return Err(error!(AmmError::InvalidAmount));
        }
        Ok(output_u128 as u64)
    }
    
    fn execute_swap(&self, swap_a: bool, input_amount: u64, output_amount: u64) -> Result<()> {
        if swap_a {
            // Swap A to B: user sends A to pool, pool sends B to user
            self.transfer_from_user_to_pool(input_amount, true)?;
            self.transfer_from_pool_to_user(output_amount, false)?;
        } else {
            // Swap B to A: user sends B to pool, pool sends A to user
            self.transfer_from_user_to_pool(input_amount, false)?;
            self.transfer_from_pool_to_user(output_amount, true)?;
        }
        
        Ok(())
    }
    
    fn transfer_from_user_to_pool(&self, amount: u64, is_token_a: bool) -> Result<()> {
        if is_token_a {
            // Transfer token A with transfer hook
            let mut transfer_ix = spl_token_2022::instruction::transfer_checked(
                &spl_token_2022::id(),
                &self.user_account_a.key(),
                &self.mint_a.key(),
                &self.pool_account_a.key(),
                &self.user.key(),
                &[&self.user.key()],
                amount,
                6,
            ).unwrap();
            
            // Add transfer hook accounts for mint A (validation account only)
            transfer_ix.accounts.push(AccountMeta::new_readonly(
                self.extra_account_meta_list_a.key(),
                false,
            ));
            
            // Invoke the modified instruction
            let account_infos = &[
                self.token_program.to_account_info(),
                self.user_account_a.to_account_info(),
                self.mint_a.to_account_info(),
                self.pool_account_a.to_account_info(),
                self.user.to_account_info(),
                self.extra_account_meta_list_a.to_account_info(),
            ];
            
            invoke(&transfer_ix, account_infos)?;
        } else {
            // Transfer token B with transfer hook
            let mut transfer_ix = spl_token_2022::instruction::transfer_checked(
                &spl_token_2022::id(),
                &self.user_account_b.key(),
                &self.mint_b.key(),
                &self.pool_account_b.key(),
                &self.user.key(),
                &[&self.user.key()],
                amount,
                6,
            ).unwrap();
            
            // Add transfer hook accounts for mint B (validation account only)
            transfer_ix.accounts.push(AccountMeta::new_readonly(
                self.extra_account_meta_list_b.key(),
                false,
            ));
            
            // Invoke the modified instruction
            let account_infos = &[
                self.token_program.to_account_info(),
                self.user_account_b.to_account_info(),
                self.mint_b.to_account_info(),
                self.pool_account_b.to_account_info(),
                self.user.to_account_info(),
                self.extra_account_meta_list_b.to_account_info(),
            ];
            
            invoke(&transfer_ix, account_infos)?;
        }
        
        Ok(())
    }
    
    fn transfer_from_pool_to_user(&self, amount: u64, is_token_a: bool) -> Result<()> {
        // Get pool authority bump from pool state
        let pool_authority_bump = self.pool.pool_authority_bump;
        
        let pool_key = self.pool.key();
        let mint_a_key = self.mint_a.key();
        let mint_b_key = self.mint_b.key();
        
        // Create the signer seeds for the pool authority PDA
        let authority_seeds = &[
            pool_key.as_ref(),
            mint_a_key.as_ref(),
            mint_b_key.as_ref(),
            POOL_AUTHORITY_SEED,
            &[pool_authority_bump],
        ];
        let signer_seeds = &[&authority_seeds[..]];
        
        if is_token_a {
            // Transfer token A from pool to user with transfer hook
            let mut transfer_ix = spl_token_2022::instruction::transfer_checked(
                &spl_token_2022::id(),
                &self.pool_account_a.key(),
                &self.mint_a.key(),
                &self.user_account_a.key(),
                &self.pool_authority.key(),
                &[],
                amount,
                6,
            ).unwrap();
            
            // Add transfer hook accounts for mint A (validation account only)
            transfer_ix.accounts.push(AccountMeta::new_readonly(
                self.extra_account_meta_list_a.key(),
                false,
            ));
            
            // Invoke the modified instruction with PDA signing
            let account_infos = &[
                self.token_program.to_account_info(),
                self.pool_account_a.to_account_info(),
                self.mint_a.to_account_info(),
                self.user_account_a.to_account_info(),
                self.pool_authority.to_account_info(),
                self.extra_account_meta_list_a.to_account_info(),
            ];
            
            invoke_signed(&transfer_ix, account_infos, &[&authority_seeds[..]])?;
        } else {
            // Transfer token B from pool to user with transfer hook
            let mut transfer_ix = spl_token_2022::instruction::transfer_checked(
                &spl_token_2022::id(),
                &self.pool_account_b.key(),
                &self.mint_b.key(),
                &self.user_account_b.key(),
                &self.pool_authority.key(),
                &[],
                amount,
                6,
            ).unwrap();
            
            // Add transfer hook accounts for mint B (validation account only)
            transfer_ix.accounts.push(AccountMeta::new_readonly(
                self.extra_account_meta_list_b.key(),
                false,
            ));
            
            // Invoke the modified instruction with PDA signing
            let account_infos = &[
                self.token_program.to_account_info(),
                self.pool_account_b.to_account_info(),
                self.mint_b.to_account_info(),
                self.user_account_b.to_account_info(),
                self.pool_authority.to_account_info(),
                self.extra_account_meta_list_b.to_account_info(),
            ];
            
            invoke_signed(&transfer_ix, account_infos, &[&authority_seeds[..]])?;
        }
        
        Ok(())
    }
} 