// Export all types from the three-program architecture
export type { TokenSetup } from './token_setup';
export type { Amm } from './amm';


// Re-export the IDLs for convenience
export { default as TOKEN_SETUP_IDL } from './token_setup.json';
export { default as AMM_IDL } from './amm.json';