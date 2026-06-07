import type { Metadata } from 'next'
import { Poppins } from 'next/font/google'
import NavActions from '@/components/NavActions'
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
        <nav className="bg-mh-surface border-b border-mh-border px-6 py-3 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold text-mh-text">The Test Tribe</span>
            <span className="text-mh-border">|</span>
            <span className="text-sm text-mh-muted font-medium">Mission Control</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/" className="text-sm text-mh-muted hover:text-mh-text font-medium transition-colors">Home</a>
            <NavActions />
          </div>
        </nav>
        <main className="max-w-[1440px] mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  )
}
