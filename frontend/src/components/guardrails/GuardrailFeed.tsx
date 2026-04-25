'use client'
import { motion } from 'framer-motion'
import { ShieldOff, AlertTriangle, Clock, CheckCircle2, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/index'
import { truncateTx, formatRelative } from '@/lib/utils'
import type { GuardrailEvent, GuardrailSeverity } from '@/types'

const MOCK: GuardrailEvent[] = [
  { _id: '1', companyId: 'demo', timestamp: new Date(Date.now() - 600000).toISOString(),
    severity: 'blocked', tier: 4, agentRole: 'cfo_agent',
    attemptedAction: 'DELETE transactions WHERE flagged=true',
    reason: 'Goodhart\'s Law violation: improving anomaly metric by removing flagged data',
    solanaTx: '4xLg0RbDef456', outcome: 'Action rejected + owner notified + Solana memo written' },
  { _id: '2', companyId: 'demo', timestamp: new Date(Date.now() - 3600000).toISOString(),
    severity: 'goodhart', tier: 3, agentRole: 'cfo_agent',
    attemptedAction: 'Disable CloudWatch monitoring to reduce AWS costs',
    reason: 'Recommendation removes measurement system to improve cost metric',
    solanaTx: null, outcome: 'Recommendation suppressed — not shown to user' },
  { _id: '3', companyId: 'demo', timestamp: new Date(Date.now() - 7200000).toISOString(),
    severity: 'gated', tier: 3, agentRole: 'payment_agent',
    attemptedAction: 'execute:payment — $3,000 to WorkContract #0047',
    reason: 'Tier 3 action requires owner approval before execution',
    solanaTx: null, outcome: 'Pending owner approval (2h 15m)' },
  { _id: '4', companyId: 'demo', timestamp: new Date(Date.now() - 9000000).toISOString(),
    severity: 'approved', tier: 3, agentRole: 'payment_agent',
    attemptedAction: 'execute:payment — $800 Milestone 2',
    reason: 'HITL gate cleared — owner approved',
    solanaTx: '3xKf9QpAbc123', outcome: 'Payment executed · Solana tx confirmed' },
]

const severityConfig: Record<GuardrailSeverity, {
  icon: React.ElementType; color: string; bg: string; border: string; label: string; badge: 'ember' | 'gold' | 'jade' | 'gray'
}> = {
  blocked:  { icon: ShieldOff,      color: 'text-ember-400', bg: 'bg-ember-400/8',  border: 'border-ember-400/20',  label: 'BLOCKED',  badge: 'ember' },
  goodhart: { icon: AlertTriangle,  color: 'text-gold-400',  bg: 'bg-gold-400/8',   border: 'border-gold-400/20',   label: 'GOODHART', badge: 'gold'  },
  gated:    { icon: Clock,          color: 'text-sapphire-400', bg: 'bg-sapphire-400/8', border: 'border-sapphire-400/20', label: 'HITL GATE', badge: 'gray' },
  approved: { icon: CheckCircle2,   color: 'text-jade-400',  bg: 'bg-jade-400/8',   border: 'border-jade-400/20',   label: 'APPROVED', badge: 'jade' },
}

export function GuardrailFeed({ events = MOCK }: { events?: GuardrailEvent[] }) {
  return (
    <div className="space-y-3">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Blocked (24h)', value: '2', color: 'text-ember-400' },
          { label: 'Goodhart Flags', value: '1', color: 'text-gold-400' },
          { label: 'HITL Gates', value: '3', color: 'text-sapphire-400' },
          { label: 'Auto-Approved', value: '14', color: 'text-jade-400' },
        ].map(stat => (
          <div key={stat.label} className="glass rounded-xl border border-white/6 p-3 text-center">
            <div className={`text-2xl font-display font-semibold ${stat.color}`}>{stat.value}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {events.map((event, i) => {
        const cfg = severityConfig[event.severity]
        const Icon = cfg.icon
        return (
          <motion.div key={event._id}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className={`glass rounded-xl border ${cfg.border} p-4`}>
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                <Icon size={14} className={cfg.color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge variant={cfg.badge} className="text-[9px]">{cfg.label}</Badge>
                  <span className="text-[10px] text-gray-500 font-mono">Tier {event.tier} · {event.agentRole}</span>
                  <span className="text-[10px] text-gray-600 ml-auto">{formatRelative(event.timestamp)}</span>
                </div>
                <div className="text-sm font-mono text-gray-300 mb-1 truncate">{event.attemptedAction}</div>
                <div className="text-[11px] text-gray-500 mb-2">{event.reason}</div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-gray-600">→ {event.outcome}</span>
                  {event.solanaTx && (
                    <a href={`https://explorer.solana.com/tx/${event.solanaTx}?cluster=devnet`}
                      target="_blank" rel="noopener"
                      className="flex items-center gap-1 text-[10px] text-sapphire-400 hover:text-sapphire-300 font-mono">
                      {truncateTx(event.solanaTx)} <ExternalLink size={9} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}