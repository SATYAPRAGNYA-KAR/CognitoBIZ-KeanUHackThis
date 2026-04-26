'use client'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Badge } from '@/components/ui/index'
import { Button } from '@/components/ui/Button'
import { Clock, ChevronRight, Zap } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Contract } from '@/types'

const statusVariant: Record<string, 'gold' | 'jade' | 'ember' | 'gray'> = {
  draft: 'gray', active: 'gold', completed: 'jade', disputed: 'ember', cancelled: 'gray',
}

interface ContractCardProps {
  contract: Contract
  index?: number
  onActivate?: (contractId: string) => Promise<void>
}

export function ContractCard({ contract, index = 0, onActivate }: ContractCardProps) {
  const completed = contract.milestones.filter(m => m.status === 'paid' || m.status === 'approved').length
  const total = contract.milestones.length
  const pct = total > 0 ? (completed / total) * 100 : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
    >
      <Link href={`/contracts/${contract._id}`}>
        <div className="glass rounded-2xl border border-white/6 p-5 hover:border-gold-400/20 transition-all group cursor-pointer">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={statusVariant[contract.status] ?? 'gray'} className="text-[9px]">
                  {contract.status}
                </Badge>
                {contract.escrowTxInit && (
                  <Badge variant="jade" className="text-[9px]">Escrow ✓</Badge>
                )}
              </div>
              <h3 className="font-semibold text-white text-sm truncate group-hover:text-gold-400 transition-colors">
                {contract.title}
              </h3>
              <div className="text-xs text-gray-500 mt-0.5">{contract.vendorEmail}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-lg font-mono text-white">{formatCurrency(contract.totalValue)}</div>
              <div className="text-[10px] text-gray-500">{formatCurrency(contract.totalReleased)} released</div>
            </div>
          </div>

          {/* Progress */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-gray-500">{completed}/{total} milestones</span>
              <span className="text-[10px] text-gray-500">{Math.round(pct)}%</span>
            </div>
            <div className="h-1 bg-obsidian-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, delay: index * 0.07 + 0.2 }}
                className="h-full bg-gradient-to-r from-gold-500 to-jade-400 rounded-full"
              />
            </div>
          </div>

          {/* Milestone dots */}
          {total > 0 && (
            <div className="grid gap-1.5 mb-4" style={{ gridTemplateColumns: `repeat(${Math.min(total, 10)}, 1fr)` }}>
              {contract.milestones.map(m => (
                <div
                  key={m.id}
                  className={`h-1.5 rounded-full ${
                    m.status === 'paid' || m.status === 'approved' ? 'bg-jade-400'
                    : m.status === 'submitted' ? 'bg-gold-400'
                    : 'bg-obsidian-700'
                  }`}
                  title={m.title}
                />
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
              <Clock size={10} />
              <span>Due {contract.deadline ? formatDate(contract.deadline) : '—'}</span>
            </div>

            {/* Activate escrow button for drafts — stops link propagation */}
            {contract.status === 'draft' && onActivate && (
              <button
                onClick={e => { e.preventDefault(); onActivate(contract._id) }}
                className="flex items-center gap-1.5 text-[11px] font-medium text-gold-400 hover:text-gold-300 bg-gold-400/8 border border-gold-400/15 rounded-lg px-2.5 py-1 transition-all"
              >
                <Zap size={10} /> Initialize Escrow
              </button>
            )}

            {contract.escrowWallet && (
              <div className="flex items-center gap-1 text-[10px] text-sapphire-400 font-mono">
                <span>{contract.escrowWallet.slice(0, 6)}…</span>
              </div>
            )}

            <ChevronRight size={13} className="text-gray-600 group-hover:text-gold-400 transition-colors" />
          </div>
        </div>
      </Link>
    </motion.div>
  )
}