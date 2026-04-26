// src/app/ClientLayout.tsx
'use client'

import { Sidebar } from '@/components/layout/Sidebar'
import { usePathname } from 'next/navigation'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showSidebar = pathname.startsWith('/dashboard')

  return (
    <div className="min-h-screen bg-obsidian-950 bg-grid flex">
      {showSidebar ? <Sidebar /> : null}
      <main className={showSidebar ? 'flex-1 pl-60 min-h-screen' : 'flex-1 min-h-screen'}>
        {children}
      </main>
    </div>
  )
}
