'use client'
import { motion } from 'framer-motion'
import { CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/index'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import type { Milestone } from '@/types'

interface EvidenceReviewProps {
  milestone: Milestone
  onApprove?: () => void
  onRequestRevision?: () => void
  approving?: boolean
}

export function EvidenceReview({
  milestone,
  onApprove,
  onRequestRevision,
  approving = false,
}: EvidenceReviewProps) {
  const review = milestone.gemmaReview

  if (!review) {
    return <div className="text-sm text-gray-500 text-center py-8">No Gemma review available yet</div>
  }

  const passCount = review.checks.filter((check) => check.passed).length
  const totalCount = review.checks.length

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white">
            Milestone {milestone.id}: {milestone.title}
          </h3>
          <div className="text-xs text-gray-500 mt-0.5">
            {passCount}/{totalCount} checks passed | {formatCurrency(milestone.value)} pending release
          </div>
        </div>
        <Badge variant={review.confidence === 'high' ? 'jade' : review.confidence === 'medium' ? 'gold' : 'ember'}>
          Gemma confidence: {review.confidence}
        </Badge>
      </div>

      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
          review.overallPass ? 'bg-jade-400/8 border-jade-400/20' : 'bg-gold-400/8 border-gold-400/20'
        }`}
      >
        {review.overallPass ? (
          <CheckCircle2 size={16} className="text-jade-400" />
        ) : (
          <AlertCircle size={16} className="text-gold-400" />
        )}
        <p className="text-sm text-gray-300">{review.recommendation}</p>
      </div>

      <div className="space-y-2">
        <div className="text-[9px] text-gray-600 uppercase tracking-widest">Verification Checks</div>
        {review.checks.map((check, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-start gap-3 glass rounded-lg px-3 py-2.5 border border-white/6"
          >
            {check.passed ? (
              <CheckCircle2 size={13} className="text-jade-400 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle size={13} className="text-gold-400 mt-0.5 shrink-0" />
            )}
            <div>
              <div className="text-xs font-medium text-gray-200">{check.label}</div>
              {check.note ? <div className="text-[11px] text-gray-500 mt-0.5">{check.note}</div> : null}
            </div>
          </motion.div>
        ))}
      </div>

      {milestone.evidenceSubmitted.length > 0 && (
        <div>
          <div className="text-[9px] text-gray-600 uppercase tracking-widest mb-2">Submitted Evidence</div>
          {milestone.evidenceSubmitted.map((evidence, index) => (
            <a
              key={index}
              href={evidence.startsWith('http') ? evidence : '#'}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-2 text-sm text-sapphire-400 hover:text-sapphire-300 mb-1"
            >
              <ExternalLink size={12} /> {evidence}
            </a>
          ))}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button
          variant="ghost"
          disabled={approving}
          onClick={() => {
            onRequestRevision?.()
            toast('Revision requested - vendor notified')
          }}
        >
          Request Revision
        </Button>
        <Button
          variant="primary"
          disabled={approving}
          onClick={() => {
            onApprove?.()
            toast.success(`${formatCurrency(milestone.value)} released via Solana`)
          }}
          className="flex-1"
        >
          Approve & Release {formatCurrency(milestone.value)}
        </Button>
      </div>
    </motion.div>
  )
}
