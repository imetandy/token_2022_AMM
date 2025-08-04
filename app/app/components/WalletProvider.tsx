'use client'

import { FC, ReactNode, useMemo } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { clusterApiUrl } from '@solana/web3.js'
import dynamic from 'next/dynamic'

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
  // Set to devnet for development
  const network = WalletAdapterNetwork.Devnet
  
  // You can also provide a custom RPC endpoint
  const endpoint = useMemo(() => clusterApiUrl(network), [network])
  
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