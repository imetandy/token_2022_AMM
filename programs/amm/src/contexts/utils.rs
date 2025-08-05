// Utility functions for AMM calculations

pub fn calculate_constant_product_swap_output(
    input_amount: u64,
    input_reserve: u64,
    output_reserve: u64,
) -> u64 {
    // Constant product formula: (x + dx) * (y - dy) = x * y
    // where dx is input_amount and dy is output_amount
    // Solving for dy: dy = (dx * y) / (x + dx)
    
    if input_reserve == 0 || output_reserve == 0 {
        return 0;
    }
    
    (input_amount * output_reserve) / (input_reserve + input_amount)
}

pub fn calculate_lp_tokens_to_mint(
    amount_a: u64,
    amount_b: u64,
    total_lp_supply: u64,
    reserve_a: u64,
    reserve_b: u64,
) -> u64 {
    if total_lp_supply == 0 {
        // First liquidity deposit
        return (amount_a + amount_b) / 2;
    }
    
    // Calculate LP tokens based on the proportion of liquidity being added
    let lp_from_a = (amount_a * total_lp_supply) / reserve_a;
    let lp_from_b = (amount_b * total_lp_supply) / reserve_b;
    
    // Return the minimum to ensure fair distribution
    std::cmp::min(lp_from_a, lp_from_b)
} 