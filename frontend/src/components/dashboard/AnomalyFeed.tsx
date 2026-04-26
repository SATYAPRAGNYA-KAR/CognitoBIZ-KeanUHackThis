'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X, ChevronRight, TrendingUp, Lightbulb, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatRelative } from '@/lib/utils'
import type { AnomalyCard } from '@/types'

const MOCK: AnomalyCard[] = [
  {
    _id: '1', transactionId: 't1', vendor: 'Amazon Web Services', amount: 3400, avgAmount: 980,
    category: 'Infrastructure', flagReason: '247% above monthly average',
    gemmaNote: 'Spike correlates with your product launch on Apr 3rd. Traffic has since normalized — consider rightsizing EC2 instances.',
    suggestion: 'Review database instance sizes. Estimated savings: $1,400–1,800/mo.',
    severity: 'high', date: new Date(Date.now() - 86400000).toISOString(), dismissed: false,
  },
  {
    _id: '2', transactionId: 't2', vendor: 'Figma', amount: 480, avgAmount: 480,
    category: 'Software', flagReason: 'Auto-renewal detected — 3 users inactive 60+ days',
    gemmaNote: 'This subscription renews automatically in 3 days. Three team members haven\'t logged in for over 60 days.',
    suggestion: 'Downgrade to a smaller seat count before renewal to save ~$180/mo.',
    severity: 'medium', date: new Date(Date.now() - 172800000).toISOString(), dismissed: false,
  },
  {
    _id: '3', transactionId: 't3', vendor: 'Stripe', amount: 1200, avgAmount: 340,
    category: 'Payment Processing', flagReason: '253% above average — tied to revenue spike',
    gemmaNote: 'This increase is expected and healthy — it correlates with your best revenue day this month at $18,400.',
    suggestion: 'No action needed. Monitor if fees remain elevated without matching revenue.',
    severity: 'low', date: new Date(Date.now() - 259200000).toISOString(), dismissed: false,
  },
]

const severityConfig = {
  high: { border: 'border-l-ember-400/60', icon: 'text-ember-400', badge: 'bg-ember-400/10 text-ember-400' },
  medium: { border: 'border-l-gold-400/60', icon: 'text-gold-400', badge: 'bg-gold-400/10 text-gold-400' },
  low: { border: 'border-l-jade-400/60', icon: 'text-jade-400', badge: 'bg-jade-400/10 text-jade-400' },
}

interface AnomalyFeedProps {
  // Accept either `data` (legacy) or `anomalies` (from useMetrics)
  data?: AnomalyCard[]
  anomalies?: AnomalyCard[]
  loading?: boolean
  onDismiss?: (transactionId: string) => void
}

export function AnomalyFeed({ data, anomalies, loading, onDismiss }: AnomalyFeedProps) {
  const source = anomalies ?? data ?? MOCK
  const [items, setItems] = useState(source.filter(d => !d.dismissed))
  const [expanded, setExpanded] = useState<string | null>(null)

  // Sync when external data changes
  useEffect(() => {
    setItems(source.filter(d => !d.dismissed))
  }, [JSON.stringify(source)])

  const dismiss = (item: AnomalyCard) => {
    setItems(prev => prev.filter(x => x._id !== item._id))
    // Call parent dismiss with transactionId for backend sync
    if (onDismiss) {
      onDismiss(item.transactionId)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-gray-600" />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <AnimatePresence>
        {items.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8 text-gray-600 text-sm">
            No anomalies detected ✓
          </motion.div>
        )}
        {items.map(item => {
          const cfg = severityConfig[item.severity]
          const isExpanded = expanded === item._id
          return (
            <motion.div
              key={item._id}
              layout
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10, height: 0 }}
              className={`glass rounded-xl border-l-2 ${cfg.border} overflow-hidden`}
            >
              {/* Summary row */}
              <div
                className="flex items-start gap-3 p-3 cursor-pointer"
                onClick={() => setExpanded(isExpanded ? null : item._id)}
              >
                <AlertTriangle size={14} className={`${cfg.icon} mt-0.5 shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-white truncate">{item.vendor}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${cfg.badge}`}>{item.severity}</span>
                  </div>
                  <p className="text-[11px] text-gray-500">{item.flagReason} · {formatCurrency(item.amount)} vs avg {formatCurrency(item.avgAmount)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-gray-600">{formatRelative(item.date)}</span>
                  <ChevronRight size={12} className={`text-gray-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </div>
              </div>

              {/* Expanded detail */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-white/6"
                  >
                    <div className="p-3 space-y-2">
                      <div className="flex gap-2">
                        <TrendingUp size={12} className="text-sapphire-400 mt-0.5 shrink-0" />
                        <p className="text-[11px] text-gray-400 leading-relaxed">{item.gemmaNote}</p>
                      </div>
                      <div className="flex gap-2">
                        <Lightbulb size={12} className="text-gold-400 mt-0.5 shrink-0" />
                        <p className="text-[11px] text-gold-400/80 leading-relaxed">{item.suggestion}</p>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="ghost" onClick={() => dismiss(item)}>
                          Dismiss
                        </Button>
                        <Button size="sm" variant="secondary">Investigate</Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}