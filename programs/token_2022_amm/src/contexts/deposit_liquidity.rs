use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        Mint, Token2022, TokenAccount, transfer_checked, TransferChecked,
    },
};

use crate::{Pool};
use crate::constants::{POOL_AUTHORITY_SEED};

impl<'info> DepositLiquidity<'info> { 
    pub fn deposit_liquidity(
        &mut self,
        _bumps: &DepositLiquidityBumps,
        amount_a: u64,
        amount_b: u64,
    ) -> Result<()> {
        msg!("=== Starting DepositLiquidity ===");
        msg!("Amount A: {}", amount_a);
        msg!("Amount B: {}", amount_b);
        
        // Calculate LP tokens to mint based on current pool state
        let liquidity_tokens = self.calculate_liquidity_tokens(amount_a, amount_b)?;
        msg!("Calculated liquidity tokens: {}", liquidity_tokens);
        
        // Transfer tokens from user to pool
        let transfer_ctx_a = CpiContext::new(
            self.token_program.to_account_info(),
            TransferChecked {
                from: self.user_account_a.to_account_info(),
                mint: self.mint_a.to_account_info(),
                to: self.pool_account_a.to_account_info(),
                authority: self.user.to_account_info(),
            },
        );
        transfer_checked(transfer_ctx_a, amount_a, 6)?;

        let transfer_ctx_b = CpiContext::new(
            self.token_program.to_account_info(),
            TransferChecked {
                from: self.user_account_b.to_account_info(),
                mint: self.mint_b.to_account_info(),
                to: self.pool_account_b.to_account_info(),
                authority: self.user.to_account_info(),
            },
        );
        transfer_checked(transfer_ctx_b, amount_b, 6)?;

        // Mint LP tokens to user
        let seeds = &[
            self.pool.amm.as_ref(),
            self.pool.mint_a.as_ref(),
            self.pool.mint_b.as_ref(),
            POOL_AUTHORITY_SEED.as_ref(),
            &[_bumps.pool_authority],
        ];
        let signer_seeds = &[&seeds[..]];

        let mint_ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            anchor_spl::token_interface::MintTo {
                mint: self.mint_liquidity.to_account_info(),
                to: self.user_liquidity_account.to_account_info(),
                authority: self.pool_authority.to_account_info(),
            },
            signer_seeds,
        );
        anchor_spl::token_interface::mint_to(mint_ctx, liquidity_tokens)?;

        // Update pool total liquidity
        self.pool.total_liquidity = self.pool.total_liquidity.checked_add(liquidity_tokens)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        Ok(())
    }

    fn calculate_liquidity_tokens(&self, amount_a: u64, amount_b: u64) -> Result<u64> {
        // Scale down by 6 decimals to avoid overflow, then scale back up
        // LP tokens = sqrt(amount_a * amount_b) = sqrt((amount_a / 1e6) * (amount_b / 1e6)) * 1e6
        let scaled_amount_a = amount_a / 1_000_000;
        let scaled_amount_b = amount_b / 1_000_000;
        
        msg!("Scaled amount A: {} (original: {})", scaled_amount_a, amount_a);
        msg!("Scaled amount B: {} (original: {})", scaled_amount_b, amount_b);
        
        // Calculate product with scaled values
        let scaled_product = scaled_amount_a.checked_mul(scaled_amount_b)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        
        msg!("Scaled product: {}", scaled_product);
        
        // Use integer square root on scaled product
        let scaled_liquidity_tokens = self.integer_sqrt(scaled_product)?;
        
        msg!("Scaled liquidity tokens: {}", scaled_liquidity_tokens);
        
        // Scale back up by 6 decimals
        let liquidity_tokens = scaled_liquidity_tokens.checked_mul(1_000_000)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        
        msg!("Final liquidity tokens: {}", liquidity_tokens);
        
        Ok(liquidity_tokens)
    }
    
    fn integer_sqrt(&self, n: u64) -> Result<u64> {
        if n == 0 {
            return Ok(0);
        }
        
        let mut x = n;
        let mut y = (x + 1) / 2;
        
        while y < x {
            x = y;
            y = (x + n / x) / 2;
        }
        
        Ok(x)
    }
}

#[derive(Accounts)]
pub struct DepositLiquidity<'info> {
    #[account(
        mut,
        seeds = [
            pool.amm.as_ref(),
            pool.mint_a.as_ref(),
            pool.mint_b.as_ref(),
        ],
        bump,
        has_one = mint_a,
        has_one = mint_b,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// CHECK: The Pool authority account
    #[account(
        seeds = [
            pool.amm.key().as_ref(),
            pool.mint_a.key().as_ref(),
            pool.mint_b.key().as_ref(),
            POOL_AUTHORITY_SEED,
        ],
        bump,
    )]
    pub pool_authority: AccountInfo<'info>,

    /// The user providing liquidity
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub mint_liquidity: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut)]
    pub mint_a: Box<InterfaceAccount<'info, Mint>>,
    
    #[account(mut)]
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
        associated_token::mint = mint_liquidity,
        associated_token::authority = user,
    )]
    pub user_liquidity_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Solana ecosystem accounts
    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
}
