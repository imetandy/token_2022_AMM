'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { FC } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import the wallet button to avoid SSR issues
const WalletMultiButtonDynamic = dynamic(
  () => Promise.resolve(WalletMultiButton),
  { 
    ssr: false,
    loading: () => (
      <button className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md opacity-50 cursor-not-allowed">
        Loading...
      </button>
    )
  }
)

export const WalletConnectButton: FC = () => {
  const { publicKey } = useWallet()

  return (
    <div className="flex items-center gap-4">
      <WalletMultiButtonDynamic className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md" />
      {publicKey && (
        <div className="text-sm text-gray-600">
          Connected: {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
        </div>
      )}
    </div>
  )
} 