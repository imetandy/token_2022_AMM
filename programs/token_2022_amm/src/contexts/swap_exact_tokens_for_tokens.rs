use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken, token_2022::TransferChecked, token_interface::{
        Mint,
        Token2022,
        TokenAccount
    }
};



use crate::{
    constants::{AMM_SEED, POOL_AUTHORITY_SEED},
    errors::*,
    state::Amm,
    state::Pool,
};

#[derive(Accounts)]
pub struct SwapExactTokensForTokens<'info> {
    #[account(
        seeds = [
            AMM_SEED,
            amm.pool_id.as_bytes(),
        ],
        bump,
    )]
    pub amm: Account<'info, Amm>,

    /// CHECK: Read only authority
    #[account(
        mut,
        seeds = [
            amm.key().as_ref(),
            mint_a.key().as_ref(),
            mint_b.key().as_ref(),
            POOL_AUTHORITY_SEED,
        ],
        bump,
    )]
    pub pool_authority: AccountInfo<'info>,

    /// The account doing the swap
    pub trader: Signer<'info>,

    pub mint_a: Box<InterfaceAccount<'info, Mint>>,
    pub mint_b: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        seeds = [
            pool.amm.as_ref(),
            pool.mint_a.key().as_ref(),
            pool.mint_b.key().as_ref(),
        ],
        bump,
        has_one = amm,
        has_one = mint_a,
        has_one = mint_b,
    )]
    pub pool: Box<Account<'info, Pool>>,
    #[account(
        mut,
        constraint = pool_account_a.owner == pool_authority.key(),
        constraint = pool_account_a.mint == mint_a.key(),
    )] pub pool_account_a: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = pool_account_b.owner == pool_authority.key(),
        constraint = pool_account_b.mint == mint_b.key(),
    )] pub pool_account_b: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint_a,
        associated_token::authority = trader,
    )] pub trader_account_a: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint_b,
        associated_token::authority = trader,
    )] pub trader_account_b: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The account paying for rent and SOL fees
    #[account(mut)] pub payer: Signer<'info>,

    /// SOL fee collector account
    /// CHECK: This account receives SOL fees from swaps
    #[account(mut)]
    pub sol_fee_collector: AccountInfo<'info>,

    // Solana accounts
    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info> SwapExactTokensForTokens<'info> {
    pub fn swap_exact_tokens_for_tokens(
        &mut self,
        swap_a: bool,
        input_amount: u64,
        min_output_amount: u64,
        bumps: &SwapExactTokensForTokensBumps,
    ) -> Result<()> {
        // Prevent depositing assets the depositor does not own
        let input = if swap_a && input_amount > self.trader_account_a.amount {
            self.trader_account_a.amount
        } else if !swap_a && input_amount > self.trader_account_b.amount {
            self.trader_account_b.amount
        } else {
            input_amount
        };
        
        // Transfer SOL fee to fee collector
        let amm = &self.amm;
        if amm.sol_fee > 0 {
            **self.payer.try_borrow_mut_lamports()? -= amm.sol_fee;
            **self.sol_fee_collector.try_borrow_mut_lamports()? += amm.sol_fee;
        }
        
        msg!("Input: {}, SOL Fee: {} lamports", input, amm.sol_fee);
        
        let pool_a = &self.pool_account_a;
        let pool_b = &self.pool_account_b;
        
        // Scale down by 6 decimals to avoid overflow, then scale back up
        let scaled_input = input / 1_000_000;
        let scaled_pool_a = pool_a.amount / 1_000_000;
        let scaled_pool_b = pool_b.amount / 1_000_000;
        
        let scaled_output = if swap_a {
            // Constant product AMM formula: output = (input * pool_b) / (pool_a + input)
            (scaled_input * scaled_pool_b) / (scaled_pool_a + scaled_input)
        } else {
            // Constant product AMM formula: output = (input * pool_a) / (pool_b + input)
            (scaled_input * scaled_pool_a) / (scaled_pool_b + scaled_input)
        };
        
        // Scale back up by 6 decimals
        let output = scaled_output * 1_000_000;

        msg!("Pool A amount: {} (scaled: {}), Pool B amount: {} (scaled: {})", pool_a.amount, scaled_pool_a, pool_b.amount, scaled_pool_b);
        msg!("Input: {} (scaled: {}), Calculated output: {} (scaled: {}), Min output required: {}", input, scaled_input, output, scaled_output, min_output_amount);

        if output < min_output_amount {
            return err!(AmmError::OutputTooSmall);
        }

        // Compute the invariant before the trade (scaled to avoid overflow)
        let scaled_invariant = scaled_pool_a * scaled_pool_b;

        // Transfer tokens to the pool
        let authority_bump = bumps.pool_authority;
        let amm_key = self.pool.amm.key();
        let mint_a_key = self.pool.mint_a.key();
        let mint_b_key = self.pool.mint_b.key();
        
        let authority_seeds = &[
            amm_key.as_ref(),
            mint_a_key.as_ref(),
            mint_b_key.as_ref(),
            POOL_AUTHORITY_SEED,
            &[authority_bump],
        ];
        let signer_seeds = &[&authority_seeds[..]];
        if swap_a {
            // Transfer full input amount to pool
            anchor_spl::token_interface::transfer_checked(
                CpiContext::new(
                    self.token_program.to_account_info(),
                    TransferChecked {
                        from: self.trader_account_a.to_account_info(),
                        mint: self.mint_a.to_account_info(),
                        to: self.pool_account_a.to_account_info(),
                        authority: self.trader.to_account_info(),
                    },
                ),
                input,
                6,
            )?;
            anchor_spl::token_interface::transfer_checked(
                CpiContext::new_with_signer(
                    self.token_program.to_account_info(),
                    TransferChecked {
                        from: self.pool_account_b.to_account_info(),
                        mint: self.mint_b.to_account_info(),
                        to: self.trader_account_b.to_account_info(),
                        authority: self.pool_authority.to_account_info(),
                    },
                    signer_seeds,
                ),
                output,
                6,
            )?;
        } else {
            // Transfer tokens from pool to trader
            anchor_spl::token_interface::transfer_checked(
                CpiContext::new_with_signer(
                    self.token_program.to_account_info(),
                    TransferChecked {
                        from: self.pool_account_a.to_account_info(),
                        mint: self.mint_a.to_account_info(),
                        to: self.trader_account_a.to_account_info(),
                        authority: self.pool_authority.to_account_info(),
                    },
                    signer_seeds,
                ),
                output,
                6,
            )?;

            // Transfer full input amount to pool
            anchor_spl::token_interface::transfer_checked(
                CpiContext::new(
                    self.token_program.to_account_info(),
                    TransferChecked {
                        from: self.trader_account_b.to_account_info(),
                        mint: self.mint_b.to_account_info(),
                        to: self.pool_account_b.to_account_info(),
                        authority: self.trader.to_account_info(),
                    },
                ),
                input,
                6,
            )?;
        }

        msg!(
            "Traded {} tokens for {} (SOL fee: {} lamports)",
            input,
            output,
            amm.sol_fee
        );

        // Verify the invariant still holds (using scaled values)
        // Reload accounts because of the CPIs
        // We tolerate if the new invariant is higher because it means a rounding error for LPs
        self.pool_account_a.reload()?;
        self.pool_account_b.reload()?;
        let new_scaled_pool_a = self.pool_account_a.amount / 1_000_000;
        let new_scaled_pool_b = self.pool_account_b.amount / 1_000_000;
        let new_scaled_invariant = new_scaled_pool_a * new_scaled_pool_b;
        
        if scaled_invariant > new_scaled_invariant {
            return err!(AmmError::InvariantViolated);
        }

        Ok(())
    }
}