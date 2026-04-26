'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getAuthLoginUrl, getAuthLogoutUrl } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Brain, FileText, CreditCard,
  Bot, Shield, ScrollText, LogOut, ChevronRight
} from 'lucide-react'

const nav = [
  { href: '/dashboard',             label: 'Dashboard',    icon: LayoutDashboard, group: 'core' },
  { href: '/dashboard/intelligence', label: 'Intelligence', icon: Brain,           group: 'core' },
  { href: '/dashboard/contracts',   label: 'WorkContracts',icon: FileText,        group: 'core' },
  { href: '/dashboard/payments',    label: 'Payments',     icon: CreditCard,      group: 'core' },
  { href: '/dashboard/agents',      label: 'Agent Roster', icon: Bot,             group: 'system' },
  { href: '/dashboard/guardrails',  label: 'Guardrails',   icon: Shield,          group: 'system' },
  { href: '/dashboard/audit',       label: 'Audit Center', icon: ScrollText,      group: 'system' },
]

export function Sidebar() {
  const pathname = usePathname()
  const authHref = pathname.startsWith('/dashboard') ? getAuthLogoutUrl() : getAuthLoginUrl()
  const authLabel = pathname.startsWith('/dashboard') ? 'Sign out' : 'Sign in'

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 glass border-r border-white/6 flex flex-col z-40">
      {/* Logo */}
      <div className="p-5 border-b border-white/6">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl border border-gold-400/30 flex items-center justify-center glow-gold shrink-0">
            <span className="text-lg font-display font-bold text-gradient-gold">C</span>
          </div>
          <div>
            <div className="text-sm font-display font-semibold text-white leading-tight">CognitoBIZ</div>
            <div className="text-[10px] text-gray-500 font-mono">AI Chief of Staff</div>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {/* Core */}
        <div className="px-2 pb-1 pt-2">
          <span className="text-[9px] text-gray-600 uppercase tracking-widest font-medium">Core</span>
        </div>
        {nav.filter(n => n.group === 'core').map(item => (
          <NavItem key={item.href} item={item} active={pathname === item.href || pathname.startsWith(item.href + '/')} />
        ))}

        {/* System */}
        <div className="px-2 pb-1 pt-4">
          <span className="text-[9px] text-gray-600 uppercase tracking-widest font-medium">System</span>
        </div>
        {nav.filter(n => n.group === 'system').map(item => (
          <NavItem key={item.href} item={item} active={pathname === item.href} />
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-white/6 space-y-1">
        <div className="px-3 py-2 rounded-xl bg-white/3 border border-white/6">
          <div className="text-xs font-medium text-white truncate">CognitoBIZ Workspace</div>
          <div className="text-[10px] text-gray-500 truncate">Auth handled by backend</div>
        </div>
        {/* Live status */}
        <div className="px-3 py-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-jade-400 status-live" />
          <span className="text-[10px] text-gray-500">All systems operational</span>
        </div>
        <a
          href={authHref}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-gray-500 hover:text-gray-300 hover:bg-obsidian-800 transition-all text-sm"
        >
          <LogOut size={15} />
          <span>{authLabel}</span>
        </a>
      </div>
    </aside>
  )
}

function NavItem({ item, active }: { item: typeof nav[0]; active: boolean }) {
  return (
    <Link href={item.href}>
      <motion.div
        whileHover={{ x: 2 }}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group relative',
          active
            ? 'bg-gold-400/10 text-gold-400 border border-gold-400/15'
            : 'text-gray-500 hover:text-gray-300 hover:bg-obsidian-800/60'
        )}
      >
        {active && (
          <motion.div
            layoutId="activeNav"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-gold-400 rounded-full"
          />
        )}
        <item.icon size={16} className={cn(active ? 'text-gold-400' : 'text-gray-600 group-hover:text-gray-400')} />
        <span className="font-medium">{item.label}</span>
        {active && <ChevronRight size={12} className="ml-auto text-gold-400/60" />}
      </motion.div>
    </Link>
  )
}
