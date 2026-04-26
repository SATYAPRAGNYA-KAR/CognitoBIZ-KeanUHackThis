'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, Target, Users, DollarSign, ArrowRight, CheckCircle2, Database } from 'lucide-react'
import { Input } from '@/components/ui/index'

const STAGES = ['bootstrapped', 'pre-seed', 'seed', 'series-a']
const INDUSTRIES = ['SaaS', 'E-commerce', 'Fintech', 'Healthcare', 'Agency', 'Marketplace', 'Hardware', 'Other']

export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    company: '', industry: '', stage: '', teamSize: 8,
    revenueRange: '10k-50k', currency: 'USD',
  })

  const steps = [
    {
      title: 'Your company',
      icon: Building2,
      content: (
        <div className="space-y-4">
          <Input label="Company Name" placeholder="Acme Startup" value={form.company}
            onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Industry</label>
            <div className="grid grid-cols-4 gap-2">
              {INDUSTRIES.map(ind => (
                <button key={ind}
                  onClick={() => setForm(f => ({ ...f, industry: ind }))}
                  className={`py-2 rounded-xl text-xs border transition-all ${form.industry === ind
                    ? 'bg-gold-400/10 border-gold-400/30 text-gold-400'
                    : 'bg-obsidian-800 border-white/8 text-gray-400 hover:border-white/16'}`}>
                  {ind}
                </button>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Funding stage',
      icon: Target,
      content: (
        <div className="space-y-3">
          {STAGES.map(stage => (
            <button key={stage}
              onClick={() => setForm(f => ({ ...f, stage }))}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all text-sm ${form.stage === stage
                ? 'bg-gold-400/10 border-gold-400/30 text-gold-400'
                : 'bg-obsidian-800 border-white/8 text-gray-300 hover:border-white/16'}`}>
              <span className="capitalize">{stage}</span>
              {form.stage === stage && <CheckCircle2 size={14} />}
            </button>
          ))}
        </div>
      ),
    },
    {
      title: 'Connect data',
      icon: Database,
      content: (
        <div className="space-y-3">
          <button onClick={() => setStep(3)} className="w-full flex items-center gap-4 px-4 py-4 rounded-xl bg-gold-400/8 border border-gold-400/20 hover:bg-gold-400/12 transition-all">
            <div className="w-10 h-10 rounded-lg bg-gold-400/12 flex items-center justify-center"><DollarSign size={18} className="text-gold-400" /></div>
            <div className="text-left">
              <div className="text-sm font-medium text-white">Load demo data</div>
              <div className="text-xs text-gray-500">90 days of realistic startup transactions — always works</div>
            </div>
            <ArrowRight size={14} className="ml-auto text-gold-400/60" />
          </button>
          <button className="w-full flex items-center gap-4 px-4 py-4 rounded-xl bg-obsidian-800 border border-white/8 hover:border-white/16 transition-all">
            <div className="w-10 h-10 rounded-lg bg-sapphire-400/10 flex items-center justify-center"><Database size={18} className="text-sapphire-400" /></div>
            <div className="text-left">
              <div className="text-sm font-medium text-gray-200">Connect Plaid</div>
              <div className="text-xs text-gray-500">Live bank data via Plaid sandbox</div>
            </div>
          </button>
          <button className="w-full flex items-center gap-4 px-4 py-4 rounded-xl bg-obsidian-800 border border-white/8 hover:border-white/16 transition-all">
            <div className="w-10 h-10 rounded-lg bg-jade-400/10 flex items-center justify-center"><Users size={18} className="text-jade-400" /></div>
            <div className="text-left">
              <div className="text-sm font-medium text-gray-200">Upload CSV</div>
              <div className="text-xs text-gray-500">QuickBooks or bank statement export</div>
            </div>
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="min-h-screen bg-obsidian-950 bg-grid flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= step ? 'bg-gold-400' : 'bg-obsidian-700'}`} />
          ))}
        </div>

        <motion.div
          key={step}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          className="glass-strong rounded-2xl border border-white/8 p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            {(() => { const Icon = steps[step].icon; return <div className="w-9 h-9 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center"><Icon size={16} className="text-gold-400" /></div> })()}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Step {step + 1} of {steps.length}</div>
              <h2 className="font-display font-semibold text-white">{steps[step].title}</h2>
            </div>
          </div>

          {steps[step].content}

          <div className="flex gap-3 mt-8">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} className="px-4 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm hover:border-white/20 transition-all">
                Back
              </button>
            )}
            {step < steps.length - 1 && (
              <button onClick={() => setStep(s => s + 1)} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gold-500/15 border border-gold-400/25 text-gold-400 text-sm font-medium hover:bg-gold-500/25 transition-all">
                Continue <ArrowRight size={14} />
              </button>
            )}
            {step === steps.length - 1 && (
              <a href="/dashboard" className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gold-500 text-obsidian-950 text-sm font-semibold hover:bg-gold-400 transition-all">
                Launch CognitoBIZ <ArrowRight size={14} />
              </a>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}