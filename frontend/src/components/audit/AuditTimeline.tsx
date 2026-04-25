'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Clock, XCircle, ExternalLink, Filter } from 'lucide-react'
import { Badge } from '@/components/ui/index'
import { truncateTx, formatRelative } from '@/lib/utils'
import type { AuditEntry } from '@/types'

const MOCK: AuditEntry[] = [
  { _id: '1', companyId: 'demo', timestamp: new Date(Date.now() - 600000).toISOString(),
    actionType: 'payment_executed', agentId: 'payment-agent', agentRole: 'payment_agent',
    humanActor: 'John (owner)', payload: { amount: 800, vendor: 'dev@freelancer.com', contract: '#0047', milestone: 2 },
    tier: 3, hitlRequired: true, hitlApprovedBy: 'John', hitlApprovedAt: new Date().toISOString(),
    solanaTx: '3xKf9QpAbc123', solanaMemo: null, status: 'completed' },
  { _id: '2', companyId: 'demo', timestamp: new Date(Date.now() - 3600000).toISOString(),
    actionType: 'guardrail_blocked', agentId: 'cfo-agent', agentRole: 'cfo_agent',
    humanActor: null, payload: { attemptedAction: 'DELETE transactions WHERE flagged=true', reason: 'Goodhart violation' },
    tier: 4, hitlRequired: false, hitlApprovedBy: null, hitlApprovedAt: null,
    solanaTx: '4xLg0RbDef456', solanaMemo: null, status: 'blocked' },
  { _id: '3', companyId: 'demo', timestamp: new Date(Date.now() - 7200000).toISOString(),
    actionType: 'contract_created', agentId: 'contract-agent', agentRole: 'contract_agent',
    humanActor: 'John (owner)', payload: { contractId: '#0047', title: 'Auth Module Dev', value: 3000 },
    tier: 2, hitlRequired: false, hitlApprovedBy: null, hitlApprovedAt: null,
    solanaTx: '1xAb2CcGhi789', solanaMemo: null, status: 'completed' },
  { _id: '4', companyId: 'demo', timestamp: new Date(Date.now() - 86400000).toISOString(),
    actionType: 'analysis_run', agentId: 'cfo-agent', agentRole: 'cfo_agent',
    humanActor: null, payload: { type: 'benchmark', categories: 5 },
    tier: 1, hitlRequired: false, hitlApprovedBy: null, hitlApprovedAt: null,
    solanaTx: null, solanaMemo: null, status: 'completed' },
  { _id: '5', companyId: 'demo', timestamp: new Date(Date.now() - 172800000).toISOString(),
    actionType: 'escrow_initialized', agentId: 'payment-agent', agentRole: 'payment_agent',
    humanActor: 'John (owner)', payload: { contractId: '#0047', amount: 3000, wallet: '8xKf3Rp' },
    tier: 3, hitlRequired: true, hitlApprovedBy: 'John', hitlApprovedAt: new Date(Date.now() - 172700000).toISOString(),
    solanaTx: '2xBc1DaJkl012', solanaMemo: null, status: 'completed' },
]

const statusIcon = {
  completed: <CheckCircle2 size={14} className="text-jade-400" />,
  pending:   <Clock size={14} className="text-gold-400" />,
  blocked:   <XCircle size={14} className="text-ember-400" />,
}

const tierBadge: Record<number, 'gray' | 'jade' | 'gold' | 'ember'> = {
  1: 'gray', 2: 'jade', 3: 'gold', 4: 'ember',
}

const tierLabel: Record<number, string> = {
  1: 'Autonomous', 2: 'Soft approval', 3: 'Hard approval', 4: 'Blocked',
}

const actionLabels: Record<string, string> = {
  payment_executed: 'Payment Executed',
  guardrail_blocked: 'Guardrail Blocked',
  contract_created: 'Contract Created',
  analysis_run: 'Analysis Run',
  escrow_initialized: 'Escrow Initialized',
}

export function AuditTimeline({ entries = MOCK }: { entries?: AuditEntry[] }) {
  const [filter, setFilter] = useState<string>('all')

  const filtered = filter === 'all' ? entries : entries.filter(e => e.status === filter)

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <Filter size={13} className="text-gray-500" />
        {['all', 'completed', 'blocked', 'pending'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-lg text-xs capitalize transition-all ${filter === f ? 'bg-gold-400/10 text-gold-400 border border-gold-400/20' : 'text-gray-500 hover:text-gray-300 border border-transparent'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-5 top-0 bottom-0 w-px bg-white/6" />
        <div className="space-y-4">
          {filtered.map((entry, i) => (
            <motion.div key={entry._id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className="flex gap-4 relative">
              <div className="w-10 h-10 rounded-full glass border border-white/8 flex items-center justify-center shrink-0 z-10">
                {statusIcon[entry.status]}
              </div>
              <div className="flex-1 glass rounded-xl border border-white/6 p-4 min-w-0">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <span className="text-sm font-medium text-white">{actionLabels[entry.actionType] ?? entry.actionType}</span>
                    {entry.agentRole && (
                      <span className="ml-2 text-[10px] text-gray-500 font-mono">{entry.agentRole}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={tierBadge[entry.tier]} className="text-[9px]">Tier {entry.tier} · {tierLabel[entry.tier]}</Badge>
                    <span className="text-[10px] text-gray-600">{formatRelative(entry.timestamp)}</span>
                  </div>
                </div>

                {/* Payload summary */}
                <div className="text-[11px] text-gray-500 mb-2 font-mono bg-obsidian-800 rounded-lg px-3 py-1.5 overflow-x-auto whitespace-pre">
                  {JSON.stringify(entry.payload, null, 0).replace(/[{}]/g, '').replace(/"/g, '').replace(/,/g, ' · ')}
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {entry.hitlApprovedBy && (
                    <span className="text-[10px] text-jade-400">✓ Approved by {entry.hitlApprovedBy}</span>
                  )}
                  {entry.humanActor && !entry.hitlApprovedBy && (
                    <span className="text-[10px] text-gray-500">Actor: {entry.humanActor}</span>
                  )}
                  {entry.solanaTx && (
                    <a href={`https://explorer.solana.com/tx/${entry.solanaTx}?cluster=devnet`} target="_blank" rel="noopener"
                      className="flex items-center gap-1 text-[10px] text-sapphire-400 hover:text-sapphire-300 transition-colors font-mono">
                      {truncateTx(entry.solanaTx)} <ExternalLink size={9} />
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}