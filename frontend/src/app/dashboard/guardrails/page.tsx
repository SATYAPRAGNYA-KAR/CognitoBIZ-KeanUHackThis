'use client'
import { TopBar } from '@/components/layout/TopBar'
import { GuardrailFeed } from '@/components/guardrails/GuardrailFeed'
import { Card } from '@/components/ui/Card'
import { Shield } from 'lucide-react'

export default function GuardrailsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Guardrail System" subtitle="Constitutional AI safety | Goodhart's Law detection" />
      <div className="p-6 space-y-5">
        <div className="flex items-start gap-3 px-4 py-3 bg-ember-400/8 border border-ember-400/15 rounded-xl">
          <Shield size={14} className="text-ember-400 mt-0.5 shrink-0" />
          <p className="text-xs text-gray-400">
            Every Gemma 4 call has constitutional constraints injected into the system prompt.
            A secondary Goodhart detector checks all recommendations before they are shown to you.
            Tier 4 actions are permanently blocked with no override.
          </p>
        </div>
        <Card title="Guardrail Activity Log" subtitle="Last 24 hours | Live feed">
          <GuardrailFeed />
        </Card>
      </div>
    </div>
  )
}
