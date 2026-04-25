import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CognitoBIZ AI — Your AI Chief of Staff',
  description: 'A governed AI Chief of Staff for startups. Observe finances, advise on decisions, manage vendor contracts with Solana payments, and audit every agent action.',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-obsidian-950 text-gray-100 font-body antialiased">
        {children}
      </body>
    </html>
  )
}