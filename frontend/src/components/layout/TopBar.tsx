'use client'
import { useState } from 'react'
import { Bell, Search, Mic } from 'lucide-react'
import { Badge } from '@/components/ui/index'
import { NotificationPanel } from './NotificationPanel'
import { cn } from '@/lib/utils'

interface TopBarProps {
  title: string
  subtitle?: string
}

export function TopBar({ title, subtitle }: TopBarProps) {
  const [notifOpen, setNotifOpen] = useState(false)
  const [unread] = useState(3) // TODO: wire to API

  return (
    <>
      <header className="h-16 border-b border-white/6 glass flex items-center justify-between px-6 sticky top-0 z-30">
        {/* Title */}
        <div>
          <h1 className="font-display font-semibold text-white text-lg leading-tight">{title}</h1>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <button className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-xl text-gray-500 hover:text-gray-300',
            'bg-obsidian-800 border border-white/8 hover:border-white/14 transition-all text-sm'
          )}>
            <Search size={14} />
            <span className="hidden sm:inline text-xs">Search...</span>
            <span className="hidden sm:inline text-[10px] text-gray-600 font-mono bg-obsidian-700 px-1.5 py-0.5 rounded">⌘K</span>
          </button>

          {/* Voice */}
          <button className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:text-jade-400 bg-obsidian-800 border border-white/8 hover:border-jade-400/20 transition-all">
            <Mic size={15} />
          </button>

          {/* Notifications */}
          <button
            onClick={() => setNotifOpen(true)}
            className="relative w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:text-gold-400 bg-obsidian-800 border border-white/8 hover:border-gold-400/20 transition-all"
          >
            <Bell size={15} />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gold-500 text-obsidian-950 text-[9px] font-bold flex items-center justify-center">
                {unread}
              </span>
            )}
          </button>

          {/* Avatar */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-500/30 to-jade-500/20 border border-white/10 flex items-center justify-center text-sm font-medium text-gold-400">
            F
          </div>
        </div>
      </header>

      <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
    </>
  )
}