import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Moonlit Horizon — TTT Sales Ops',
  description: 'The Test Tribe Corporate Training Sales Dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">
        <nav className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-slate-800">The Test Tribe</span>
            <span className="text-slate-300">|</span>
            <span className="text-sm text-slate-500 font-medium">Sales Ops Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/" className="text-sm text-slate-600 hover:text-slate-900 font-medium">Dashboard</a>
            <a href="/upload" className="text-sm text-slate-600 hover:text-slate-900 font-medium">Upload Prospects</a>
            <a href="/book-prospect" className="text-sm text-slate-600 hover:text-slate-900 font-medium">Book Prospect</a>
            <a href="/book" className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-full hover:bg-blue-700 font-medium transition-colors">
              + Book Meeting
            </a>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  )
}
