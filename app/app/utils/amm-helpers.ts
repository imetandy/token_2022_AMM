/**
 * AMM Helper Functions
 * Utilities for working with AMM accounts and pool IDs
 */

/**
 * Convert a byte array to a string, removing null bytes
 * @param byteArray - The byte array to convert
 * @returns The string representation
 */
export function byteArrayToString(byteArray: Uint8Array): string {
  return new TextDecoder().decode(byteArray).replace(/\0/g, '');
}

/**
 * Convert a string to a fixed-size byte array (64 bytes)
 * @param str - The string to convert
 * @returns A 64-byte array padded with zeros
 */
export function stringToByteArray(str: string): Uint8Array {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  const result = new Uint8Array(64);
  result.set(bytes.slice(0, 64)); // Copy up to 64 bytes, rest will be zeros
  return result;
}

/**
 * Validate that a pool ID is within the acceptable length (max 64 characters)
 * @param poolId - The pool ID to validate
 * @returns Object with isValid boolean and error message if invalid
 */
export function validatePoolId(poolId: string): { isValid: boolean; error?: string } {
  if (!poolId || poolId.trim().length === 0) {
    return { isValid: false, error: 'Pool ID cannot be empty' };
  }
  
  if (poolId.length > 64) {
    return { isValid: false, error: 'Pool ID cannot exceed 64 characters' };
  }
  
  // Check for valid characters (alphanumeric, hyphens, underscores)
  const validPattern = /^[a-zA-Z0-9_-]+$/;
  if (!validPattern.test(poolId)) {
    return { isValid: false, error: 'Pool ID can only contain letters, numbers, hyphens, and underscores' };
  }
  
  return { isValid: true };
}

/**
 * Get a readable pool ID from an AMM account
 * @param ammAccount - The AMM account data
 * @returns The pool ID as a string
 */
export function getPoolIdFromAmmAccount(ammAccount: any): string {
  if (!ammAccount || !ammAccount.poolId) {
    return '';
  }
  return byteArrayToString(ammAccount.poolId);
}

/**
 * Create a short, unique pool ID from a base name
 * @param baseName - The base name for the pool
 * @param suffix - Optional suffix to make it unique
 * @returns A short pool ID
 */
export function createShortPoolId(baseName: string, suffix?: string): string {
  const cleanBase = baseName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const shortBase = cleanBase.slice(0, 20); // Limit base name to 20 chars
  
  if (suffix) {
    const cleanSuffix = suffix.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const shortSuffix = cleanSuffix.slice(0, 10); // Limit suffix to 10 chars
    return `${shortBase}-${shortSuffix}`;
  }
  
  return shortBase;
}

/**
 * Generate a unique pool ID with timestamp
 * @param baseName - The base name for the pool
 * @returns A unique pool ID with timestamp
 */
export function generateUniquePoolId(baseName: string): string {
  const timestamp = Date.now().toString(36); // Base36 timestamp
  return createShortPoolId(baseName, timestamp);
} 