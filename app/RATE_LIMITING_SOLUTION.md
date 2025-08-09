# Rate Limiting Solution for Solana Devnet

## Problem
You're experiencing 429 rate limiting errors from the Solana devnet RPC endpoint:
```
429 : {"jsonrpc":"2.0","error":{"code": 429, "message":"Connection rate limits exceeded"}, "id": "..."}
```

## Root Causes
1. **Multiple RPC calls**: Each transaction makes multiple `getLatestBlockhash()` calls
2. **No request throttling**: Rapid successive requests overwhelm the endpoint
3. **Public endpoint limitations**: `https://api.devnet.solana.com` has strict rate limits
4. **No connection pooling**: Each component creates its own connection

## Solutions Implemented

### 1. Blockhash Caching
- Caches blockhash for 10 seconds to reduce RPC calls
- Reuses the same blockhash for multiple transactions within the cache window

### 2. Request Throttling
- Enforces minimum 100ms delay between requests
- Prevents overwhelming the RPC endpoint

### 3. Exponential Backoff Retry Logic
- Automatically retries failed requests with increasing delays
- Handles temporary rate limiting gracefully

### 4. Connection Optimization
- Single connection instance with optimized settings
- Proper timeout and retry configurations

## How to Use

### Option 1: Use the Improved Code (Recommended)
The code has been updated with:
- `BlockhashCache` class for caching
- `RequestThrottler` class for rate limiting
- `sendTransactionWithRetry()` method with exponential backoff
- `confirmTransactionWithRetry()` method for reliable confirmations

### Option 2: Use Alternative RPC Endpoints

#### Current Configuration (Helius + Fallbacks):
The application is now configured to use:
1. **Helius RPC** as primary endpoint (with your API key)
2. **Automatic fallback** to regular devnet if Helius fails
3. **Multiple fallback endpoints** for maximum reliability

```typescript
// Current configuration in app/app/config/rpc-config.ts
export const RPC_CONFIG = {
  heliusApiKey: "52e2a914-28ac-4bd4-a222-1d44168db946",
  primary: "https://devnet.helius-rpc.com/?api-key=52e2a914-28ac-4bd4-a222-1d44168db946",
  fallbacks: [
    "https://api.devnet.solana.com",
    "https://solana-devnet.rpc.extrnode.com",
    "https://devnet.genesysgo.net",
  ],
  // ... rest of config
};
```

#### Free Alternatives:
```typescript
// Update in app/app/config/rpc-config.ts
export const RPC_CONFIG = {
  primary: "https://solana-devnet.rpc.extrnode.com",
  fallbacks: [
    "https://devnet.genesysgo.net",
    "https://api.devnet.solana.com", // Fallback to original
  ],
  // ... rest of config
};
```

#### Paid RPC Providers (Recommended for Production):
1. **Helius** (Free tier available):
   ```typescript
   // Already configured with your API key
   primary: "https://devnet.helius-rpc.com/?api-key=52e2a914-28ac-4bd4-a222-1d44168db946"
   ```

2. **QuickNode**:
   ```typescript
   primary: "https://your-endpoint.solana-devnet.quiknode.pro/YOUR_API_KEY/"
   ```

3. **Alchemy**:
   ```typescript
   primary: "https://solana-devnet.g.alchemy.com/v2/YOUR_API_KEY"
   ```

### Option 3: Implement Your Own RPC Node
For maximum control, run your own Solana devnet RPC node.

## Configuration Options

### Adjust Rate Limiting
```typescript
// In app/app/config/rpc-config.ts
rateLimit: {
  requestsPerSecond: 5, // Reduce for stricter limits
  burstLimit: 10, // Reduce burst allowance
  retryDelay: 2000, // Increase delay between retries
  maxRetries: 5, // Increase retry attempts
}
```

### Adjust Blockhash Cache Duration
```typescript
// In app/app/utils/wallet-client-new.ts
private readonly CACHE_DURATION_MS = 15000; // Increase to 15 seconds
```

### Adjust Request Throttling
```typescript
// In app/app/utils/wallet-client-new.ts
private readonly MIN_INTERVAL_MS = 200; // Increase to 200ms between requests
```

## Best Practices

### 1. Batch Operations
Instead of multiple separate transactions, batch them when possible:
```typescript
// Instead of:
await createToken();
await initializeCounter();
await mintTokens();

// Consider batching in a single transaction when possible
```

### 2. Use Connection Pooling
```typescript
// Create a single connection instance and reuse it
const connection = createOptimizedConnection();
const walletClient = new WalletClientNew(connection);
```

### 3. Implement Proper Error Handling
```typescript
try {
  const result = await walletClient.createTokenWithHook(...);
  if (!result.success) {
    console.error('Transaction failed:', result.error);
  }
} catch (error) {
  if (error.message.includes('429')) {
    console.log('Rate limited, retrying...');
    // Implement custom retry logic
  }
}
```

### 4. Monitor RPC Usage
Add logging to track RPC calls:
```typescript
// In the throttler class
async throttle(): Promise<void> {
  console.log(`RPC request at ${new Date().toISOString()}`);
  // ... rest of throttling logic
}
```

## Testing the Solution

1. **Test with multiple rapid transactions**:
   ```typescript
   // This should now work without rate limiting
   for (let i = 0; i < 5; i++) {
     await walletClient.createTokenWithHook(...);
   }
   ```

2. **Monitor console logs** for throttling and caching behavior

3. **Check transaction success rates** - should be much higher now

## Production Considerations

1. **Use paid RPC providers** for production applications
2. **Implement health checks** for RPC endpoints
3. **Add monitoring** for rate limiting events
4. **Consider implementing circuit breakers** for failing endpoints
5. **Use multiple RPC providers** with automatic failover

## Troubleshooting

### Still Getting Rate Limited?
1. Check if you're using the updated code
2. Verify RPC endpoint configuration
3. Increase throttling delays
4. Consider switching to a paid RPC provider

### Transactions Failing?
1. Check console logs for specific error messages
2. Verify network connectivity
3. Ensure sufficient SOL balance for fees
4. Check if the RPC endpoint is healthy

### Performance Issues?
1. Reduce cache duration if transactions are failing
2. Increase throttling delays if still rate limited
3. Monitor RPC response times
4. Consider using a closer RPC endpoint geographically 