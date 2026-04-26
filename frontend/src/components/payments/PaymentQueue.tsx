'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, AlertTriangle, FileText, Repeat, ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/index'
import { Modal } from '@/components/ui/index'
import { formatCurrency, formatDate, truncateTx, apiFetch } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import type { PendingPayment } from '@/types'

const typeConfig = {
  invoice: { icon: FileText, label: 'Invoice', color: 'text-sapphire-400' },
  milestone: { icon: CheckCircle2, label: 'Milestone', color: 'text-jade-400' },
  recurring: { icon: Repeat, label: 'Recurring', color: 'text-gold-400' },
  recurring_anomaly: { icon: Repeat, label: 'Recurring', color: 'text-gold-400' },
}

const confidenceVariant: Record<string, 'jade' | 'gold' | 'ember'> = {
  high: 'jade', medium: 'gold', low: 'ember',
}

interface PaymentQueueItem {
  id: string
  type: string
  vendor: string
  amount: number
  due_date?: string
  status: string
  gemma_note?: string
  gemma_confidence?: string
  contract_id?: string
  milestone_id?: number
  source?: string
  flags?: string[]
  flag_reason?: string
  explorer_url?: string
  tx_hash?: string
}

function adaptItem(item: PaymentQueueItem): PendingPayment & { _rawId: string; explorerUrl?: string; txHash?: string; flags?: string[] } {
  return {
    _id: item.id,
    _rawId: item.id,
    type: (item.type === 'recurring_anomaly' ? 'recurring' : item.type) as PendingPayment['type'],
    vendor: item.vendor,
    amount: item.amount,
    dueDate: item.due_date || new Date().toISOString(),
    status: item.status as PendingPayment['status'],
    gemmaNote: item.gemma_note || item.flag_reason || '',
    gemmaConfidence: (item.gemma_confidence || 'medium') as PendingPayment['gemmaConfidence'],
    contractId: item.contract_id,
    milestoneId: item.milestone_id,
    explorerUrl: item.explorer_url,
    txHash: item.tx_hash,
    flags: item.flags,
  }
}

export function PaymentQueue() {
  const [items, setItems] = useState<ReturnType<typeof adaptItem>[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmItem, setConfirmItem] = useState<ReturnType<typeof adaptItem> | null>(null)
  const [approving, setApproving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchQueue = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<{ queue: PaymentQueueItem[] }>('/api/payments')
      setItems(data.queue.map(adaptItem))
    } catch (e: any) {
      setError(e.message)
      toast.error('Failed to load payment queue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  const approve = async (item: ReturnType<typeof adaptItem>) => {
    setApproving(item._id)
    setConfirmItem(null)
    try {
      let result: any

      if (item.type === 'milestone' && item.contractId && item.milestoneId != null) {
        // Approve milestone payment via contracts endpoint
        result = await apiFetch(`/api/contracts/${item.contractId}/milestones/${item.milestoneId}/approve`, {
          method: 'POST',
          body: JSON.stringify({ notes: 'Approved via Payment Queue' }),
        })
      } else if (item.type === 'invoice') {
        // Approve invoice payment — POST to payments/invoices/{id}/approve
        result = await apiFetch(`/api/payments/invoices/${item._rawId}/approve`, {
          method: 'POST',
          body: JSON.stringify({ notes: 'Approved via Payment Queue' }),
        })
      } else {
        // Dismiss recurring anomaly
        await apiFetch(`/api/payments/transactions/${item._rawId}/dismiss`, { method: 'POST' })
        result = { success: true }
      }

      setItems(prev => prev.map(p =>
        p._id === item._id
          ? {
              ...p,
              status: 'approved',
              txHash: result?.tx_result?.tx_hash || result?.solana_tx,
              explorerUrl: result?.explorer_url || (result?.tx_result?.tx_hash
                ? `https://explorer.solana.com/tx/${result.tx_result.tx_hash}?cluster=devnet`
                : undefined),
            }
          : p
      ))

      const txHash = result?.tx_result?.tx_hash || result?.solana_tx
      if (txHash) {
        toast.success(`Payment approved · Tx: ${truncateTx(txHash)}`)
      } else {
        toast.success('Payment approved')
      }
    } catch (e: any) {
      toast.error(e.message || 'Approval failed')
    } finally {
      setApproving(null)
    }
  }

  const reject = async (id: string) => {
    try {
      await apiFetch(`/api/payments/transactions/${id}/dismiss`, { method: 'POST' }).catch(() => null)
      setItems(prev => prev.map(p => p._id === id ? { ...p, status: 'rejected' } : p))
      toast.error('Payment rejected')
    } catch {
      setItems(prev => prev.map(p => p._id === id ? { ...p, status: 'rejected' } : p))
      toast.error('Payment rejected')
    }
  }

  const pending = items.filter(p => p.status === 'pending' || p.status === 'flagged')
  const done = items.filter(p => p.status !== 'pending' && p.status !== 'flagged')

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3">
        <Loader2 size={20} className="animate-spin text-gray-500" />
        <span className="text-sm text-gray-500">Loading payment queue…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8 space-y-3">
        <p className="text-sm text-ember-400">{error}</p>
        <Button size="sm" variant="ghost" onClick={fetchQueue} icon={<RefreshCw size={12} />}>Retry</Button>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {/* Header stats */}
        <div className="flex items-center gap-4 pb-2">
          <div className="text-sm text-white font-medium">{pending.length} Pending</div>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <span className="w-1.5 h-1.5 rounded-full bg-gold-400 status-live" />
            Total awaiting: {formatCurrency(pending.reduce((s, p) => s + p.amount, 0))}
          </div>
          <button onClick={fetchQueue} className="ml-auto text-gray-600 hover:text-gray-400 transition-colors">
            <RefreshCw size={12} />
          </button>
        </div>

        {pending.length === 0 && (
          <div className="text-center py-10 text-gray-600 text-sm">
            No pending payments ✓
          </div>
        )}

        <AnimatePresence>
          {pending.map((item, i) => {
            const cfgKey = item.type in typeConfig ? item.type : 'invoice'
            const cfg = typeConfig[cfgKey as keyof typeof typeConfig]
            const Icon = cfg.icon
            const isOverdue = new Date(item.dueDate) < new Date()
            const isApproving = approving === item._id
            return (
              <motion.div key={item._id}
                layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                transition={{ delay: i * 0.06 }}
                className="glass rounded-xl border border-white/8 p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-obsidian-800 border border-white/8 flex items-center justify-center">
                      <Icon size={14} className={cfg.color} />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{item.vendor}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="gray" className="text-[9px]">{cfg.label}</Badge>
                        {isOverdue && <Badge variant="ember" className="text-[9px]">Overdue</Badge>}
                        <span className="text-[10px] text-gray-500">Due {formatDate(item.dueDate)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-display font-semibold text-white">{formatCurrency(item.amount)}</div>
                    <Badge variant={confidenceVariant[item.gemmaConfidence] || 'gold'} className="text-[9px] mt-1">
                      Gemma: {item.gemmaConfidence} confidence
                    </Badge>
                  </div>
                </div>

                {item.gemmaNote && (
                  <div className="flex items-start gap-2 bg-obsidian-800 rounded-lg px-3 py-2 mb-3">
                    <AlertTriangle size={11} className="text-gold-400 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-gray-400 leading-relaxed">{item.gemmaNote}</p>
                  </div>
                )}

                {(item.flags || []).length > 0 && (
                  <div className="space-y-1 mb-3">
                    {(item.flags || []).map((flag, fi) => (
                      <div key={fi} className="flex items-center gap-2 bg-ember-400/8 border border-ember-400/15 rounded-lg px-3 py-1.5">
                        <AlertTriangle size={10} className="text-ember-400 shrink-0" />
                        <span className="text-[10px] text-ember-400/80">{flag}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => reject(item._id)} disabled={isApproving}>Reject</Button>
                  {item.contractId && (
                    <Button size="sm" variant="secondary">View Contract</Button>
                  )}
                  <Button
                    size="sm"
                    variant="primary"
                    className="ml-auto"
                    loading={isApproving}
                    onClick={() => setConfirmItem(item)}
                    disabled={isApproving}
                  >
                    Approve & Pay via Solana
                  </Button>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {done.length > 0 && (
          <div className="border-t border-white/6 pt-3 space-y-2">
            <div className="text-[10px] text-gray-600 uppercase tracking-widest">Processed</div>
            {done.map(item => (
              <div key={item._id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-obsidian-800 border border-white/6">
                {item.status === 'approved'
                  ? <CheckCircle2 size={13} className="text-jade-400" />
                  : <XCircle size={13} className="text-ember-400" />}
                <span className="text-xs text-gray-400 flex-1">{item.vendor}</span>
                <span className="text-xs font-mono text-gray-500">{formatCurrency(item.amount)}</span>
                {item.txHash && (
                  <a
                    href={item.explorerUrl || `https://explorer.solana.com/tx/${item.txHash}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-sapphire-400 flex items-center gap-1 hover:text-sapphire-300"
                  >
                    {truncateTx(item.txHash)} <ExternalLink size={9} />
                  </a>
                )}
                <Badge variant={item.status === 'approved' ? 'jade' : 'ember'} className="text-[9px]">
                  {item.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm modal */}
      <Modal open={!!confirmItem} onClose={() => setConfirmItem(null)} title="Confirm Payment">
        {confirmItem && (
          <div className="space-y-4">
            <div className="bg-obsidian-800 rounded-xl p-4 border border-white/8">
              <div className="text-xs text-gray-500 mb-1">Payment details</div>
              <div className="text-white font-medium">{confirmItem.vendor}</div>
              <div className="text-2xl font-display font-semibold text-jade-400 mt-1">{formatCurrency(confirmItem.amount)}</div>
              {confirmItem.type === 'milestone' && confirmItem.contractId && (
                <div className="text-xs text-gray-500 mt-1">
                  Contract milestone · ID {confirmItem.milestoneId}
                </div>
              )}
            </div>
            <div className="text-sm text-gray-400 bg-ember-400/8 border border-ember-400/15 rounded-xl p-3">
              ⚠️ This will execute a Solana transaction on Devnet. This action is irreversible once confirmed.
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setConfirmItem(null)} className="flex-1">Cancel</Button>
              <Button variant="primary" onClick={() => approve(confirmItem)} className="flex-1">
                Confirm & Execute
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}