'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { MilestoneTracker } from '@/components/contracts/MilestoneTracker'
import { EvidenceReview } from '@/components/contracts/EvidenceReview'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/index'
import { Button } from '@/components/ui/Button'
import { useContracts } from '@/hooks/useContracts'
import { formatCurrency, formatDate, truncateTx } from '@/lib/utils'
import type { Contract } from '@/types'
import { ExternalLink, Shield, Loader2, AlertTriangle } from 'lucide-react'

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { getContract, approveMilestone } = useContracts()
  const [contract, setContract] = useState<Contract | null>(null)
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState<number | null>(null)

  useEffect(() => {
    getContract(id).then(c => { setContract(c); setLoading(false) })
  }, [id, getContract])

  const handleApprove = async (milestoneId: number) => {
    if (!contract) return
    setApproving(milestoneId)
    try {
      await approveMilestone(contract._id, milestoneId)
      const updated = await getContract(id)
      setContract(updated)
    } finally {
      setApproving(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <TopBar title="Contract Detail" />
        <div className="flex items-center justify-center flex-1 text-gray-500">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading...
        </div>
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="flex flex-col min-h-screen">
        <TopBar title="Contract Not Found" />
        <div className="flex items-center justify-center flex-1 text-gray-500">
          <AlertTriangle size={20} className="mr-2" /> Contract not found.
        </div>
      </div>
    )
  }

  const statusVariant: Record<string, 'jade' | 'gold' | 'gray' | 'ember'> = {
    active: 'jade', draft: 'gold', completed: 'gray', cancelled: 'ember',
  }
  const progress = contract.milestones.length > 0
    ? Math.round((contract.milestones.filter(m => m.status === 'paid').length / contract.milestones.length) * 100)
    : 0

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar
        title={contract.title}
        subtitle={`WorkContract · ${contract.vendorEmail || 'No vendor assigned'}`}
      />
      <div className="p-6 space-y-5">
        {/* Summary header */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Status', value: <Badge variant={statusVariant[contract.status] || 'gray'}>{contract.status}</Badge> },
            { label: 'Total Value', value: formatCurrency(contract.totalValue) },
            { label: 'Released', value: <span className="text-jade-400">{formatCurrency(contract.totalReleased)}</span> },
            { label: 'Deadline', value: contract.deadline ? formatDate(contract.deadline) : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="glass rounded-xl p-4 border border-white/6">
              <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">{label}</div>
              <div className="text-sm font-medium text-white">{value}</div>
            </div>
          ))}
        </div>

        {/* Escrow proof */}
        {contract.escrowTxInit && (
          <div className="flex items-center gap-3 px-4 py-3 bg-jade-400/8 border border-jade-400/15 rounded-xl">
            <Shield size={14} className="text-jade-400 shrink-0" />
            <div className="flex-1 text-xs text-gray-400">
              <span className="text-jade-400 font-medium">Escrow confirmed</span> — {formatCurrency(contract.totalValue)} locked on Solana Devnet.
              Tx: <span className="font-mono text-gray-300">{truncateTx(contract.escrowTxInit)}</span>
            </div>
            <a
              href={`https://explorer.solana.com/tx/${contract.escrowTxInit}?cluster=devnet`}
              target="_blank" rel="noopener"
              className="flex items-center gap-1 text-[11px] text-jade-400 hover:text-jade-300"
            >
              View <ExternalLink size={10} />
            </a>
          </div>
        )}

        {/* Risk flags */}
        {contract.riskFlags.length > 0 && (
          <div className="space-y-1">
            {contract.riskFlags.map((flag, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-gold-400 bg-gold-400/8 border border-gold-400/15 rounded-lg px-3 py-2">
                <AlertTriangle size={12} /> {flag}
              </div>
            ))}
          </div>
        )}

        {/* Progress bar */}
        <Card title="Milestone Progress">
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-2">
              <span>{contract.milestones.filter(m => m.status === 'paid').length} of {contract.milestones.length} milestones complete</span>
              <span className="text-gold-400">{progress}%</span>
            </div>
            <div className="h-2 bg-obsidian-700 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-gold-500 to-jade-400 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <MilestoneTracker
            milestones={contract.milestones}
            onApprove={handleApprove}
            approving={approving}
          />
        </Card>

        {/* Evidence review for submitted milestones */}
        {contract.milestones.filter(m => m.status === 'submitted').map(m => (
          <EvidenceReview
            key={m.id}
            milestone={m}
            onApprove={() => handleApprove(m.id)}
            onRequestRevision={() => {}}
            approving={approving === m.id}
          />
        ))}

        {/* Audit trail */}
        {contract.auditTrail.length > 0 && (
          <Card title="Contract Audit Chain" subtitle="Immutable event log">
            <div className="space-y-3">
              {contract.auditTrail.map((entry: any, i: number) => (
                <div key={i} className="flex items-start gap-3 text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-gold-400 mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <div className="text-gray-300 font-medium">{entry.event}</div>
                    <div className="text-gray-600 mt-0.5">{entry.actor} · {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '—'}</div>
                    {entry.solana_tx && (
                      <a
                        href={`https://explorer.solana.com/tx/${entry.solana_tx}?cluster=devnet`}
                        target="_blank" rel="noopener"
                        className="flex items-center gap-1 text-jade-400 hover:text-jade-300 mt-1"
                      >
                        Tx: {truncateTx(entry.solana_tx)} <ExternalLink size={9} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}