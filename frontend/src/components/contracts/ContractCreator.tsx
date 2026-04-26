'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Textarea } from '@/components/ui/index'
import { Button } from '@/components/ui/Button'
import { Wand2, ChevronDown, ChevronUp, AlertTriangle, CheckCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'react-hot-toast'

interface GeneratedMilestone {
  id: number
  title: string
  description: string
  due_day: number
  value: number
  evidence_required: string[]
}

export interface GeneratedContract {
  title: string
  total_value: number
  currency: string
  timeline_days: number
  milestones: GeneratedMilestone[]
  market_rate_flag: string | null
  risk_flags: string[]
}

interface ContractCreatorProps {
  onCreated?: (contract: GeneratedContract) => void
  onSubmit?: (description: string, vendorEmail?: string) => Promise<void> | void
  onCancel?: () => void
  loading?: boolean
}

export function ContractCreator({
  onCreated,
  onSubmit,
  onCancel,
  loading: externalLoading = false,
}: ContractCreatorProps) {
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState<GeneratedContract | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)

  const generate = async () => {
    if (!prompt.trim()) return

    setGenerating(true)
    await new Promise((resolve) => setTimeout(resolve, 1800))
    setGenerated({
      title: 'User Authentication Module Development',
      total_value: 3000,
      currency: 'USD',
      timeline_days: 14,
      market_rate_flag:
        '$3,000 for 2 weeks implies about $75/hour, at the lower end of market rate ($70-120/hr). Consider whether that matches your quality bar.',
      risk_flags: [],
      milestones: [
        {
          id: 1,
          title: 'Project Setup and Architecture Review',
          description: 'Repository setup, tech stack confirmation, and architecture document.',
          due_day: 2,
          value: 300,
          evidence_required: ['GitHub repo link', 'Architecture doc (PDF or link)'],
        },
        {
          id: 2,
          title: 'Email and Password Authentication',
          description: 'Registration, login, logout, and password reset flows implemented and tested.',
          due_day: 6,
          value: 800,
          evidence_required: ['GitHub PR link', 'Screen recording of all flows'],
        },
        {
          id: 3,
          title: 'Google OAuth Integration',
          description: 'Google OAuth 2.0 login implemented and tested across Chrome and Safari.',
          due_day: 9,
          value: 700,
          evidence_required: ['GitHub PR link', 'Screen recording of Google login'],
        },
        {
          id: 4,
          title: 'Security Review and Testing',
          description: 'JWT implementation review, rate limiting, and test coverage above 70 percent.',
          due_day: 12,
          value: 600,
          evidence_required: ['Test coverage report', 'Security checklist'],
        },
        {
          id: 5,
          title: 'Final Delivery and Documentation',
          description: 'Code merged to main, README updated, and handoff call completed.',
          due_day: 14,
          value: 600,
          evidence_required: ['Final PR merged', 'README link', 'Loom handoff video'],
        },
      ],
    })
    setGenerating(false)
  }

  const handleCreate = async () => {
    if (!generated) return

    if (onSubmit) {
      await onSubmit(prompt)
      return
    }

    toast.success('WorkContract created. Solana escrow initializing...')
    onCreated?.(generated)
    setGenerated(null)
    setPrompt('')
  }

  return (
    <div className="space-y-4">
      <Textarea
        label="Describe the work"
        placeholder="e.g. I need a freelance developer to build a user authentication module with Google OAuth and email/password. Timeline 2 weeks. Budget $3,000."
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        className="h-24"
      />

      <Button
        variant="primary"
        onClick={generate}
        loading={generating}
        disabled={!prompt.trim() || externalLoading}
        icon={<Wand2 size={14} />}
      >
        Generate with Gemma 4
      </Button>

      <AnimatePresence>
        {generated && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="glass rounded-xl border border-gold-400/20 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-white text-sm">{generated.title}</h3>
                <div className="text-right">
                  <div className="text-lg font-display font-semibold text-jade-400">
                    {formatCurrency(generated.total_value)}
                  </div>
                  <div className="text-[10px] text-gray-500">{generated.timeline_days} days</div>
                </div>
              </div>

              {generated.market_rate_flag ? (
                <div className="flex gap-2 bg-gold-400/8 border border-gold-400/15 rounded-lg px-3 py-2 mb-3">
                  <AlertTriangle size={12} className="text-gold-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-gold-400/80">{generated.market_rate_flag}</p>
                </div>
              ) : null}

              <div className="space-y-2">
                {generated.milestones.map((milestone) => (
                  <div key={milestone.id} className="bg-obsidian-800 rounded-lg border border-white/6">
                    <button
                      onClick={() => setExpanded(expanded === milestone.id ? null : milestone.id)}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-gold-400/10 text-gold-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {milestone.id}
                        </span>
                        <span className="text-sm text-gray-200">{milestone.title}</span>
                        <span className="text-[10px] text-gray-500">Day {milestone.due_day}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-jade-400">{formatCurrency(milestone.value)}</span>
                        {expanded === milestone.id ? (
                          <ChevronUp size={12} className="text-gray-500" />
                        ) : (
                          <ChevronDown size={12} className="text-gray-500" />
                        )}
                      </div>
                    </button>
                    <AnimatePresence>
                      {expanded === milestone.id ? (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-3 space-y-2 border-t border-white/6 pt-2">
                            <p className="text-[11px] text-gray-400">{milestone.description}</p>
                            <div>
                              <div className="text-[9px] text-gray-600 uppercase tracking-wider mb-1">
                                Evidence Required
                              </div>
                              {milestone.evidence_required.map((evidence, index) => (
                                <div key={index} className="flex items-center gap-1.5 text-[11px] text-gray-400">
                                  <CheckCircle size={9} className="text-jade-400" /> {evidence}
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setGenerated(null)
                  onCancel?.()
                }}
                className="flex-1"
              >
                Discard
              </Button>
              <Button
                variant="primary"
                onClick={handleCreate}
                loading={externalLoading}
                className="flex-1"
              >
                Create and Initialize Escrow
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
