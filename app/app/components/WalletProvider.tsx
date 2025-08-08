'use client'

import { FC, ReactNode, useMemo } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import dynamic from 'next/dynamic'
import { getBestRpcEndpoint } from '../config/rpc-config'

// Import the default styles for the wallet modal
import '@solana/wallet-adapter-react-ui/styles.css'

interface Props {
  children: ReactNode
}

// Dynamically import the wallet modal provider to avoid SSR issues
const WalletModalProviderDynamic = dynamic(
  () => Promise.resolve(WalletModalProvider),
  { ssr: false }
)

export const WalletContextProvider: FC<Props> = ({ children }) => {
  // Use our optimized RPC endpoint (Helius with fallback)
  const endpoint = useMemo(() => getBestRpcEndpoint(), [])
  
  // Initialize wallets that you want to support
  // Note: Phantom and other standard wallets are automatically detected
  const wallets = useMemo(() => [], [])

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProviderDynamic>
          {children}
        </WalletModalProviderDynamic>
      </WalletProvider>
    </ConnectionProvider>
  )
} 