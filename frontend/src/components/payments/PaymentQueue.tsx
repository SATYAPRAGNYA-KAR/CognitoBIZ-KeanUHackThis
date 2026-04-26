'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, AlertTriangle, FileText, Repeat, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/index'
import { Modal } from '@/components/ui/index'
import { formatCurrency, formatDate, truncateTx } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import type { PendingPayment } from '@/types'

const MOCK: PendingPayment[] = [
  { _id: '1', type: 'invoice', vendor: 'Acme Corp', amount: 2400,
    dueDate: new Date().toISOString(), status: 'pending',
    gemmaNote: 'Invoice verified. Terms: Net 30. No unusual clauses detected.',
    gemmaConfidence: 'high' },
  { _id: '2', type: 'milestone', vendor: 'Dev Freelancer (WC #0047 — Milestone 3)', amount: 700,
    dueDate: new Date(Date.now() + 86400000).toISOString(), status: 'pending',
    gemmaNote: 'Gemma assessment: ✅ High confidence. All 3 evidence items verified.',
    gemmaConfidence: 'high', contractId: 'demo-contract-001', milestoneId: 3 },
  { _id: '3', type: 'recurring', vendor: 'Amazon Web Services', amount: 3400,
    dueDate: new Date(Date.now() + 432000000).toISOString(), status: 'pending',
    gemmaNote: '⚠️ 247% above your $980 average. Correlates with product launch — review if still justified.',
    gemmaConfidence: 'medium' },
]

const typeConfig = {
  invoice: { icon: FileText, label: 'Invoice', color: 'text-sapphire-400' },
  milestone: { icon: CheckCircle2, label: 'Milestone', color: 'text-jade-400' },
  recurring: { icon: Repeat, label: 'Recurring', color: 'text-gold-400' },
}

const confidenceVariant: Record<string, 'jade' | 'gold' | 'ember'> = {
  high: 'jade', medium: 'gold', low: 'ember',
}

export function PaymentQueue({ payments = MOCK }: { payments?: PendingPayment[] }) {
  const [items, setItems] = useState(payments)
  const [confirmItem, setConfirmItem] = useState<PendingPayment | null>(null)

  const approve = (id: string) => {
    setItems(prev => prev.map(p => p._id === id ? { ...p, status: 'approved' } : p))
    setConfirmItem(null)
    toast.success('Payment approved & queued for Solana execution')
  }

  const reject = (id: string) => {
    setItems(prev => prev.map(p => p._id === id ? { ...p, status: 'rejected' } : p))
    toast.error('Payment rejected')
  }

  const pending = items.filter(p => p.status === 'pending')
  const done = items.filter(p => p.status !== 'pending')

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
        </div>

        <AnimatePresence>
          {pending.map((item, i) => {
            const cfg = typeConfig[item.type]
            const Icon = cfg.icon
            const isOverdue = new Date(item.dueDate) < new Date()
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
                    <Badge variant={confidenceVariant[item.gemmaConfidence]} className="text-[9px] mt-1">
                      Gemma: {item.gemmaConfidence} confidence
                    </Badge>
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-obsidian-800 rounded-lg px-3 py-2 mb-3">
                  <AlertTriangle size={11} className="text-gold-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-gray-400 leading-relaxed">{item.gemmaNote}</p>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => reject(item._id)}>Reject</Button>
                  {item.contractId && (
                    <Button size="sm" variant="secondary">View Contract</Button>
                  )}
                  <Button size="sm" variant="primary" className="ml-auto" onClick={() => setConfirmItem(item)}>
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
            </div>
            <div className="text-sm text-gray-400 bg-ember-400/8 border border-ember-400/15 rounded-xl p-3">
              ⚠️ This will execute a Solana transaction on Devnet. This action is irreversible once confirmed.
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setConfirmItem(null)} className="flex-1">Cancel</Button>
              <Button variant="primary" onClick={() => approve(confirmItem._id)} className="flex-1">
                Confirm & Execute
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}