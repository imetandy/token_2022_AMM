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
  const { publicKey, connect, connecting, wallets, select } = useWallet()

  return (
    <div className="flex items-center gap-4">
      <WalletMultiButtonDynamic className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-md" />
      {!publicKey && (
        <button
          className="text-xs px-2 py-1 rounded bg-gray-800 text-white hover:bg-gray-900"
          onClick={async () => {
            try {
              const dev = wallets.find(w => (w.adapter?.name as any) === 'Dev Keypair')
              if (dev) select(dev.adapter.name as any)
              await connect()
            } catch {}
          }}
          disabled={connecting}
          title="Fallback connect"
        >
          {connecting ? 'Connecting…' : 'Connect Dev Wallet'}
        </button>
      )}
      {publicKey && (
        <div className="text-xs text-gray-700">
          {publicKey.toString().slice(0, 4)}…{publicKey.toString().slice(-4)}
        </div>
      )}
    </div>
  )
} 