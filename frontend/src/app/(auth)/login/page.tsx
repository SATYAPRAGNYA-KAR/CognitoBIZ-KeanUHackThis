'use client'
import { motion } from 'framer-motion'
import { Bot, Shield, TrendingUp, Zap, ArrowRight } from 'lucide-react'

const features = [
  { icon: TrendingUp, label: 'Live Financial Pulse', desc: 'Real-time burn, runway & revenue intelligence' },
  { icon: Bot,        label: 'Governed AI Agents',   desc: 'Every agent action is scoped, audited & HITL-gated' },
  { icon: Shield,     label: 'Immutable Audit Chain', desc: 'Solana-backed tamper-proof record of all decisions' },
  { icon: Zap,        label: 'WorkContracts',         desc: 'Milestone-gated vendor payments with escrow' },
]

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-obsidian-950 bg-grid flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] shrink-0 p-10 border-r border-white/6">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl border border-gold-400/30 flex items-center justify-center glow-gold">
              <span className="text-xl font-display font-bold text-gradient-gold">C</span>
            </div>
            <div>
              <div className="font-display font-semibold text-white">CognitoBIZ</div>
              <div className="text-[10px] text-gray-500 font-mono">AI Chief of Staff</div>
            </div>
          </div>

          <h1 className="font-display text-3xl font-semibold text-white leading-tight mb-4">
            Your governed<br />
            <span className="text-gradient-gold">AI financial brain</span>
          </h1>
          <p className="text-sm text-gray-500 leading-relaxed mb-10">
            Built for startups and SMBs who need enterprise-grade AI governance, not another dashboard.
          </p>

          <div className="space-y-4">
            {features.map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.08 }}
                className="flex items-start gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-gold-400/8 border border-gold-400/12 flex items-center justify-center shrink-0 mt-0.5">
                  <f.icon size={14} className="text-gold-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-200">{f.label}</div>
                  <div className="text-xs text-gray-500">{f.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="text-[10px] text-gray-700">
          © 2025 CognitoBIZ · Built for KeanU Hackathon
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm"
        >
          <div className="glass-strong rounded-2xl border border-white/8 p-8 shadow-card">
            <h2 className="font-display font-semibold text-white text-xl mb-1">Welcome back</h2>
            <p className="text-sm text-gray-500 mb-8">Sign in to your CognitoBIZ workspace</p>

            {/* Demo quick-login */}
            <a
              href="/dashboard"
              className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-gold-400/10 border border-gold-400/20 text-gold-400 text-sm font-medium hover:bg-gold-400/15 transition-all group mb-4"
            >
              <div className="flex items-center gap-3">
                <Bot size={16} />
                <div>
                  <div>Continue as Demo Founder</div>
                  <div className="text-[10px] text-gold-400/60">founder@acmestartup.com</div>
                </div>
              </div>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </a>

            <a
              href="/vendor/demo-contract-001"
              className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-white/4 border border-white/8 text-gray-400 text-sm hover:bg-white/6 transition-all group mb-6"
            >
              <div className="flex items-center gap-3">
                <Shield size={16} />
                <div>
                  <div>Continue as Demo Vendor</div>
                  <div className="text-[10px] text-gray-600">dev@freelancer.com</div>
                </div>
              </div>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </a>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/6" /></div>
              <div className="relative flex justify-center"><span className="px-3 text-[10px] text-gray-600 bg-obsidian-800">or sign in with Auth0</span></div>
            </div>

            <button className="w-full py-2.5 rounded-xl bg-obsidian-700 border border-white/8 text-gray-300 text-sm hover:border-white/16 hover:bg-obsidian-600 transition-all">
              Continue with Auth0
            </button>

            <p className="text-center text-[11px] text-gray-600 mt-6">
              No account? Auth0 handles signup automatically on first login.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}