'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Clock, Upload, ChevronDown, ChevronUp, ExternalLink, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/index'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDate, getMilestoneColor } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import type { Milestone } from '@/types'

interface MilestoneTrackerProps {
  milestones: Milestone[]
  isVendor?: boolean
  onApprove?: (milestoneId: number) => void
  onSubmit?: (milestoneId: number, evidence: string[]) => void
  approving?: number | null
}

const statusLabel: Record<string, string> = {
  pending: 'Pending',
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  revision_requested: 'Revision Needed',
  paid: 'Paid',
}

const statusIcons: Record<string, React.ElementType> = {
  pending: Clock,
  submitted: Upload,
  under_review: AlertCircle,
  approved: CheckCircle2,
  revision_requested: AlertCircle,
  paid: CheckCircle2,
}

export function MilestoneTracker({
  milestones,
  isVendor = false,
  onApprove,
  onSubmit,
  approving = null,
}: MilestoneTrackerProps) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const [evidenceInput, setEvidenceInput] = useState('')

  const handleSubmit = (id: number) => {
    if (!evidenceInput.trim()) return
    onSubmit?.(id, [evidenceInput])
    toast.success('Evidence submitted for review')
    setEvidenceInput('')
    setExpanded(null)
  }

  return (
    <div className="space-y-2">
      {milestones.map((milestone, index) => {
        const colors = getMilestoneColor(milestone.status)
        const Icon = statusIcons[milestone.status] ?? Clock
        const isExpanded = expanded === milestone.id

        return (
          <motion.div
            key={milestone.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.06 }}
            className="glass rounded-xl border border-white/6 overflow-hidden"
          >
            <button
              onClick={() => setExpanded(isExpanded ? null : milestone.id)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/2 transition-colors"
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${colors}`}>
                <Icon size={13} />
              </div>
              <span className="text-[10px] text-gray-600 font-mono shrink-0 w-6">#{milestone.id}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-200 truncate">{milestone.title}</div>
                <div className="text-[10px] text-gray-500">Due {formatDate(milestone.dueDate)}</div>
              </div>
              <span className="text-sm font-mono text-white shrink-0">{formatCurrency(milestone.value)}</span>
              <Badge
                variant={
                  milestone.status === 'paid'
                    ? 'jade'
                    : milestone.status === 'submitted'
                      ? 'gold'
                      : milestone.status === 'revision_requested'
                        ? 'ember'
                        : 'gray'
                }
                className="text-[9px] shrink-0"
              >
                {statusLabel[milestone.status]}
              </Badge>
              {isExpanded ? (
                <ChevronUp size={12} className="text-gray-500 shrink-0" />
              ) : (
                <ChevronDown size={12} className="text-gray-500 shrink-0" />
              )}
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-white/6 px-4 pb-4 pt-3 space-y-3">
                    <p className="text-xs text-gray-400">{milestone.description}</p>

                    <div>
                      <div className="text-[9px] text-gray-600 uppercase tracking-wider mb-1">Evidence Required</div>
                      {milestone.evidenceRequired.map((evidence, evidenceIndex) => (
                        <div key={evidenceIndex} className="flex items-center gap-1.5 text-[11px] text-gray-500">
                          <CheckCircle2
                            size={9}
                            className={milestone.evidenceSubmitted.length > evidenceIndex ? 'text-jade-400' : 'text-gray-700'}
                          />
                          {evidence}
                        </div>
                      ))}
                    </div>

                    {milestone.evidenceSubmitted.length > 0 && (
                      <div>
                        <div className="text-[9px] text-gray-600 uppercase tracking-wider mb-1">Submitted Evidence</div>
                        {milestone.evidenceSubmitted.map((evidence, evidenceIndex) => (
                          <a
                            key={evidenceIndex}
                            href={evidence.startsWith('http') ? evidence : '#'}
                            target="_blank"
                            rel="noopener"
                            className="flex items-center gap-1 text-[11px] text-sapphire-400 hover:text-sapphire-300"
                          >
                            {evidence} <ExternalLink size={9} />
                          </a>
                        ))}
                      </div>
                    )}

                    {milestone.gemmaReview && (
                      <div className="bg-obsidian-800 rounded-lg p-3 border border-white/6">
                        <div className="text-[9px] text-gray-600 uppercase tracking-wider mb-2">Gemma Assessment</div>
                        {milestone.gemmaReview.checks.map((check, checkIndex) => (
                          <div key={checkIndex} className="flex items-center gap-2 text-[11px] mb-1">
                            {check.passed ? (
                              <CheckCircle2 size={10} className="text-jade-400" />
                            ) : (
                              <AlertCircle size={10} className="text-gold-400" />
                            )}
                            <span className={check.passed ? 'text-gray-400' : 'text-gold-400'}>{check.label}</span>
                            {check.note ? <span className="text-gray-600">- {check.note}</span> : null}
                          </div>
                        ))}
                        <p className="text-[11px] text-gray-500 mt-2 italic">{milestone.gemmaReview.recommendation}</p>
                        <Badge
                          variant={
                            milestone.gemmaReview.confidence === 'high'
                              ? 'jade'
                              : milestone.gemmaReview.confidence === 'medium'
                                ? 'gold'
                                : 'ember'
                          }
                          className="text-[9px] mt-2"
                        >
                          Confidence: {milestone.gemmaReview.confidence}
                        </Badge>
                      </div>
                    )}

                    {milestone.solanaTx && (
                      <a
                        href={`https://explorer.solana.com/tx/${milestone.solanaTx}?cluster=devnet`}
                        target="_blank"
                        rel="noopener"
                        className="flex items-center gap-1.5 text-[11px] text-sapphire-400 hover:text-sapphire-300 font-mono"
                      >
                        Payment tx: {milestone.solanaTx.slice(0, 12)}... <ExternalLink size={9} />
                      </a>
                    )}

                    <div className="flex gap-2 pt-1">
                      {isVendor && milestone.status === 'pending' && (
                        <div className="flex-1 space-y-2">
                          <input
                            value={evidenceInput}
                            onChange={(event) => setEvidenceInput(event.target.value)}
                            placeholder="Paste GitHub PR, Loom link, or drive link..."
                            className="w-full bg-obsidian-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-gold-400/40"
                          />
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleSubmit(milestone.id)}
                            disabled={!evidenceInput.trim()}
                          >
                            Submit Evidence
                          </Button>
                        </div>
                      )}

                      {!isVendor && milestone.status === 'submitted' && (
                        <>
                          <Button size="sm" variant="ghost">
                            Request Revision
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            disabled={approving === milestone.id}
                            onClick={() => {
                              onApprove?.(milestone.id)
                              toast.success(`Milestone ${milestone.id} approved. Payment releasing...`)
                            }}
                          >
                            Approve & Release {formatCurrency(milestone.value)}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )
      })}
    </div>
  )
}
