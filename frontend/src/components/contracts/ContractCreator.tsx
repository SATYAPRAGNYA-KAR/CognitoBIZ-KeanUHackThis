'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Textarea, Badge, Input } from '@/components/ui/index'
import { Button } from '@/components/ui/Button'
import { Loader2, Wand2, ChevronDown, ChevronUp, AlertTriangle, CheckCircle } from 'lucide-react'
import { formatCurrency, apiFetch } from '@/lib/utils'
import { toast } from 'react-hot-toast'

interface GeneratedMilestone {
  id: number
  title: string
  description: string
  due_day: number
  value: number
  evidence_required: string[]
}

interface GeneratedContract {
  contract_id: string
  contract: {
    title: string
    total_value: number
    currency: string
    timeline_days: number
    milestones: GeneratedMilestone[]
    market_rate_flag: string | null
    risk_flags: string[]
  }
  milestones: GeneratedMilestone[]
  market_rate_flag: string | null
  risk_flags: string[]
  deadline: string
}

interface Props {
  onSubmit: (description: string, vendorEmail?: string) => Promise<any>
  onCancel: () => void
  loading: boolean
}

export function ContractCreator({ onSubmit, onCancel, loading }: Props) {
  const [prompt, setPrompt] = useState('')
  const [vendorEmail, setVendorEmail] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState<GeneratedContract | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [activating, setActivating] = useState(false)

  const generate = async () => {
    if (!prompt.trim()) return
    setGenerating(true)
    try {
      const result = await apiFetch<GeneratedContract>('/api/contracts', {
        method: 'POST',
        body: JSON.stringify({
          description: prompt,
          vendor_email: vendorEmail || undefined,
        }),
      })
      setGenerated(result)
    } catch (e: any) {
      toast.error(e.message || 'Contract generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleActivate = async () => {
    if (!generated) return
    setActivating(true)
    try {
      await apiFetch(`/api/contracts/${generated.contract_id}/activate`, {
        method: 'POST',
      })
      toast.success('WorkContract activated · Solana escrow initialized ✓')
      // Notify parent to refresh list
      await onSubmit(prompt, vendorEmail || undefined)
    } catch (e: any) {
      toast.error(e.message || 'Activation failed')
    } finally {
      setActivating(false)
    }
  }

  const contract = generated?.contract
  const milestones = generated?.milestones || []

  return (
    <div className="space-y-4">
      <Textarea
        label="Describe the work"
        placeholder="e.g. I need a freelance developer to build a user authentication module with Google OAuth and email/password. Timeline 2 weeks. Budget $3,000."
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        rows={3}
      />
      <Input
        label="Vendor email (optional)"
        placeholder="dev@freelancer.com"
        type="email"
        value={vendorEmail}
        onChange={e => setVendorEmail(e.target.value)}
      />

      {!generated && (
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button
            variant="gold"
            onClick={generate}
            loading={generating}
            disabled={!prompt.trim() || generating}
            icon={<Wand2 size={14} />}
          >
            Generate with Gemma 4
          </Button>
        </div>
      )}

      <AnimatePresence>
        {contract && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Summary */}
            <div className="glass rounded-xl border border-gold-400/20 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-white text-sm">{contract.title}</h3>
                <div className="text-right">
                  <div className="text-lg font-mono text-jade-400">{formatCurrency(contract.total_value)}</div>
                  <div className="text-[10px] text-gray-500">{contract.timeline_days} days</div>
                </div>
              </div>

              {contract.market_rate_flag && (
                <div className="flex gap-2 bg-gold-400/8 border border-gold-400/15 rounded-lg px-3 py-2 mb-3">
                  <AlertTriangle size={12} className="text-gold-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-gold-400/80">{contract.market_rate_flag}</p>
                </div>
              )}

              {contract.risk_flags?.length > 0 && (
                <div className="space-y-1 mb-3">
                  {contract.risk_flags.map((flag, i) => (
                    <div key={i} className="flex gap-2 bg-ember-400/8 border border-ember-400/15 rounded-lg px-3 py-1.5">
                      <AlertTriangle size={11} className="text-ember-400 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-ember-400/80">{flag}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Milestones */}
              <div className="space-y-2">
                {milestones.map(m => (
                  <div key={m.id} className="bg-obsidian-800 rounded-lg border border-white/6">
                    <button
                      onClick={() => setExpanded(expanded === m.id ? null : m.id)}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-gold-400/10 text-gold-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {m.id}
                        </span>
                        <span className="text-sm text-gray-200">{m.title}</span>
                        <span className="text-[10px] text-gray-500">Day {m.due_day}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-jade-400">{formatCurrency(m.value)}</span>
                        {expanded === m.id
                          ? <ChevronUp size={12} className="text-gray-500" />
                          : <ChevronDown size={12} className="text-gray-500" />}
                      </div>
                    </button>
                    <AnimatePresence>
                      {expanded === m.id && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-3 space-y-2 border-t border-white/6 pt-2">
                            <p className="text-[11px] text-gray-400">{m.description}</p>
                            <div>
                              <div className="text-[9px] text-gray-600 uppercase tracking-wider mb-1">Evidence Required</div>
                              {m.evidence_required.map((e, ei) => (
                                <div key={ei} className="flex items-center gap-1.5 text-[11px] text-gray-400">
                                  <CheckCircle size={9} className="text-jade-400" /> {e}
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={() => { setGenerated(null); setPrompt('') }}
                className="flex-1"
              >
                Discard
              </Button>
              <Button
                variant="gold"
                onClick={handleActivate}
                loading={activating}
                className="flex-1"
              >
                Create & Initialize Escrow
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}