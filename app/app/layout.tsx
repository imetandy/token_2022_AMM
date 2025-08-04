import './globals.css'
import { Inter } from 'next/font/google'
import dynamic from 'next/dynamic'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Token-2022 AMM - Transfer Hook Trading',
  description: 'Trade Token-2022 tokens with transfer hooks on Solana',
}

// Dynamically import the wallet provider to avoid SSR issues
const WalletContextProvider = dynamic(
  () => import('./components/WalletProvider').then(mod => ({ default: mod.WalletContextProvider })),
  { ssr: false }
)

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <WalletContextProvider>
          <div className="min-h-screen bg-gray-50">
            {children}
          </div>
        </WalletContextProvider>
      </body>
    </html>
  )
} 