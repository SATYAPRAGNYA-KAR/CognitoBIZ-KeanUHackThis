'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Badge, Input, Textarea } from '@/components/ui/index'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDate, truncateTx, apiFetch } from '@/lib/utils'
import { Shield, CheckCircle2, Clock, ExternalLink, Upload, Loader2, AlertTriangle } from 'lucide-react'

interface VendorMilestone {
  id: number
  title: string
  description: string
  dueDate: string
  value: number
  status: string
  evidenceRequired: string[]
  evidenceSubmitted: any[]
  approvedAt: string | null
  solanaTx: string | null
  gemma_summary: string | null
}

interface VendorContract {
  id: string
  title: string
  status: string
  totalValue: number
  currency: string
  deadline: string
  milestones: VendorMilestone[]
  totalReleased: number
  escrowConfirmed: boolean
  escrowTxInit: string | null
  paymentHistory: any[]
}

const statusConfig: Record<string, { label: string; variant: 'jade' | 'gold' | 'gray' | 'ember'; icon: any }> = {
  pending: { label: 'Pending', variant: 'gray', icon: Clock },
  submitted: { label: 'Under Review', variant: 'gold', icon: Clock },
  approved: { label: 'Approved', variant: 'jade', icon: CheckCircle2 },
  paid: { label: 'Paid', variant: 'jade', icon: CheckCircle2 },
  revision_requested: { label: 'Revision Needed', variant: 'ember', icon: AlertTriangle },
}

export default function VendorPortalPage() {
  const { contractId } = useParams<{ contractId: string }>()
  const [contract, setContract] = useState<VendorContract | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<number | null>(null)
  const [evidenceLinks, setEvidenceLinks] = useState<Record<number, string>>({})
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [expandedMilestone, setExpandedMilestone] = useState<number | null>(null)

  useEffect(() => {
    apiFetch<any>(`/api/vendor/contract/${contractId}`)
      .then(data => {
        setContract({
          id: data.id,
          title: data.title,
          status: data.status,
          totalValue: data.total_value,
          currency: data.currency,
          deadline: data.deadline,
          milestones: (data.milestones || []).map((m: any) => ({
            id: m.id,
            title: m.title,
            description: m.description,
            dueDate: m.due_date,
            value: m.value,
            status: m.status,
            evidenceRequired: m.evidence_required || [],
            evidenceSubmitted: m.evidence_submitted || [],
            approvedAt: m.approved_at,
            solanaTx: m.solana_tx,
            gemma_summary: m.gemma_summary,
          })),
          totalReleased: data.total_released || 0,
          escrowConfirmed: data.escrow_confirmed,
          escrowTxInit: data.escrow_tx_init,
          paymentHistory: data.payment_history || [],
        })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [contractId])

  const handleSubmit = async (milestoneId: number) => {
    const links = evidenceLinks[milestoneId]?.split('\n').filter(l => l.trim()) || []
    if (links.length === 0) return
    setSubmitting(milestoneId)
    try {
      await apiFetch(`/api/vendor/contract/${contractId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ milestone_id: milestoneId, evidence_links: links, notes: notes[milestoneId] }),
      })
      // Refresh
      const data = await apiFetch<any>(`/api/vendor/contract/${contractId}`)
      setContract(prev => prev && ({
        ...prev,
        milestones: prev.milestones.map(m =>
          m.id === milestoneId ? { ...m, status: 'submitted' } : m
        ),
      }))
      setEvidenceLinks(prev => ({ ...prev, [milestoneId]: '' }))
    } finally {
      setSubmitting(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian-950 bg-grid flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-gold-400" />
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="min-h-screen bg-obsidian-950 bg-grid flex items-center justify-center text-gray-500">
        <AlertTriangle size={20} className="mr-2" /> Contract not found or access denied.
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-obsidian-950 bg-grid">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl border border-gold-400/30 flex items-center justify-center">
            <span className="text-xl font-bold text-gold-400">C</span>
          </div>
          <div>
            <div className="font-semibold text-white">CognitoBIZ Vendor Portal</div>
            <div className="text-xs text-gray-500">Secure · Scoped · Verified</div>
          </div>
        </div>

        {/* Contract header */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl border border-white/8 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="font-semibold text-white text-lg">{contract.title}</h1>
              <p className="text-sm text-gray-500 mt-1">Deadline: {formatDate(contract.deadline)}</p>
            </div>
            <Badge variant={contract.status === 'active' ? 'jade' : 'gray'}>{contract.status}</Badge>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-[10px] text-gray-600 uppercase tracking-widest">Total Value</div>
              <div className="text-lg font-mono text-white">{formatCurrency(contract.totalValue)}</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-600 uppercase tracking-widest">Released</div>
              <div className="text-lg font-mono text-jade-400">{formatCurrency(contract.totalReleased)}</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-600 uppercase tracking-widest">Remaining</div>
              <div className="text-lg font-mono text-gold-400">{formatCurrency(contract.totalValue - contract.totalReleased)}</div>
            </div>
          </div>

          {/* Escrow proof */}
          {contract.escrowConfirmed && (
            <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-jade-400/8 border border-jade-400/20 rounded-xl text-xs">
              <Shield size={13} className="text-jade-400" />
              <span className="text-gray-400">
                <span className="text-jade-400 font-medium">Escrow confirmed</span> — your payment is locked on Solana Devnet.
                {contract.escrowTxInit && (
                  <a
                    href={`https://explorer.solana.com/tx/${contract.escrowTxInit}?cluster=devnet`}
                    target="_blank" rel="noopener"
                    className="ml-2 text-jade-400 inline-flex items-center gap-0.5 hover:text-jade-300"
                  >
                    Verify on Explorer <ExternalLink size={9} />
                  </a>
                )}
              </span>
            </div>
          )}
        </motion.div>

        {/* Milestones */}
        <div className="space-y-3">
          <h2 className="text-xs text-gray-500 uppercase tracking-widest">Milestones</h2>
          {contract.milestones.map((m, i) => {
            const cfg = statusConfig[m.status] || statusConfig.pending
            const Icon = cfg.icon
            const isExpanded = expandedMilestone === m.id
            const canSubmit = ['pending', 'revision_requested'].includes(m.status)

            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="glass rounded-2xl border border-white/6 overflow-hidden"
              >
                <div
                  className="flex items-start gap-3 p-4 cursor-pointer"
                  onClick={() => setExpandedMilestone(isExpanded ? null : m.id)}
                >
                  <div className="w-7 h-7 rounded-lg bg-obsidian-700 border border-white/8 flex items-center justify-center text-xs font-mono text-gray-400 shrink-0">
                    {m.id}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white">{m.title}</span>
                      <Badge variant={cfg.variant} className="text-[9px]">
                        <Icon size={9} className="mr-1" />{cfg.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{m.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-mono text-gold-400">{formatCurrency(m.value)}</div>
                    {m.dueDate && <div className="text-[10px] text-gray-600 mt-0.5">Due {formatDate(m.dueDate)}</div>}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-white/6 pt-3 space-y-3">
                    <p className="text-xs text-gray-400 leading-relaxed">{m.description}</p>

                    <div>
                      <div className="text-[10px] text-gray-600 uppercase tracking-widest mb-1.5">Evidence Required</div>
                      <ul className="space-y-1">
                        {m.evidenceRequired.map((req, j) => (
                          <li key={j} className="flex items-center gap-2 text-xs text-gray-400">
                            <span className="w-1 h-1 rounded-full bg-gold-400 shrink-0" />
                            {req}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {m.gemma_summary && (
                      <div className="bg-sapphire-400/8 border border-sapphire-400/15 rounded-xl px-3 py-2 text-xs text-gray-400">
                        <span className="text-sapphire-400 font-medium">Gemma review: </span>{m.gemma_summary}
                      </div>
                    )}

                    {m.solanaTx && (
                      <a
                        href={`https://explorer.solana.com/tx/${m.solanaTx}?cluster=devnet`}
                        target="_blank" rel="noopener"
                        className="flex items-center gap-1.5 text-xs text-jade-400 hover:text-jade-300"
                      >
                        <CheckCircle2 size={12} /> Payment confirmed · {truncateTx(m.solanaTx)} <ExternalLink size={9} />
                      </a>
                    )}

                    {canSubmit && (
                      <div className="space-y-2 pt-1">
                        <Textarea
                          label="Evidence Links (one per line)"
                          placeholder="https://github.com/org/repo/pull/47&#10;https://www.loom.com/share/..."
                          rows={3}
                          value={evidenceLinks[m.id] || ''}
                          onChange={e => setEvidenceLinks(prev => ({ ...prev, [m.id]: e.target.value }))}
                        />
                        <Input
                          label="Notes (optional)"
                          placeholder="Any additional context for the reviewer..."
                          value={notes[m.id] || ''}
                          onChange={e => setNotes(prev => ({ ...prev, [m.id]: e.target.value }))}
                        />
                        <Button
                          variant="gold"
                          icon={submitting === m.id ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                          loading={submitting === m.id}
                          disabled={!evidenceLinks[m.id]?.trim()}
                          onClick={() => handleSubmit(m.id)}
                        >
                          Submit Evidence
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>

        {/* Payment history */}
        {contract.paymentHistory.length > 0 && (
          <div>
            <h2 className="text-xs text-gray-500 uppercase tracking-widest mb-3">Payment History</h2>
            <div className="glass rounded-2xl border border-white/6 divide-y divide-white/5">
              {contract.paymentHistory.map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm text-white">{p.title}</div>
                    <div className="text-xs text-gray-600 mt-0.5">{p.paid_at ? formatDate(p.paid_at) : '—'}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-jade-400">{formatCurrency(p.amount)}</span>
                    {p.solana_tx && (
                      <a
                        href={`https://explorer.solana.com/tx/${p.solana_tx}?cluster=devnet`}
                        target="_blank" rel="noopener"
                        className="text-xs text-jade-400 hover:text-jade-300 flex items-center gap-1"
                      >
                        {truncateTx(p.solana_tx)} <ExternalLink size={9} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}