import type { Metadata } from 'next'
import { Poppins } from 'next/font/google'
import NavActions from '@/components/NavActions'
import SyncErrorsBadge from '@/components/SyncErrorsBadge'
import './globals.css'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Moonlit Horizon — TTT Mission Control',
  description: 'The Test Tribe Corporate Training Mission Control Dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className="min-h-screen bg-mh-bg text-mh-text font-poppins antialiased">
        <nav className="px-6 py-3 flex items-center justify-between sticky top-0 z-[100]"
          style={{
            background: 'rgba(4,4,10,0.82)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 1px 0 rgba(232,52,28,0.08)',
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold text-mh-text">The Test Tribe</span>
            <span className="text-mh-border">|</span>
            <span className="text-sm text-mh-muted font-medium">Mission Control</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/" className="text-sm text-mh-muted hover:text-mh-text font-medium transition-colors">Home</a>
            <SyncErrorsBadge />
            <NavActions />
          </div>
        </nav>
        <main className="max-w-[1440px] mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  )
}
