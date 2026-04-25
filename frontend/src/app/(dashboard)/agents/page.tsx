'use client'
import { TopBar } from '@/components/layout/TopBar'
import { AgentRoster } from '@/components/agents/AgentRoster'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/index'
import { Shield, Info } from 'lucide-react'

export default function AgentsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Agent Roster" subtitle="Cryptographically-issued AI identities · Auth0 M2M" />
      <div className="p-6 space-y-5">
        {/* Info banner */}
        <div className="flex items-start gap-3 px-4 py-3 bg-sapphire-400/8 border border-sapphire-400/15 rounded-xl">
          <Info size={14} className="text-sapphire-400 mt-0.5 shrink-0" />
          <p className="text-xs text-gray-400">
            Each agent has an Auth0 Machine-to-Machine credential with scoped permissions. 
            Agents can never act outside their defined role. All Tier 3+ actions require human approval before execution.
          </p>
        </div>

        {/* Tier legend */}
        <Card title="HITL Tier Classification">
          <div className="grid grid-cols-4 gap-3">
            {[
              { tier: 1, label: 'Autonomous', desc: 'Read ops, analysis, drafting', variant: 'gray' as const },
              { tier: 2, label: 'Soft Approval', desc: 'Notifications, status updates', variant: 'jade' as const },
              { tier: 3, label: 'Hard Approval', desc: 'Payments, external comms', variant: 'gold' as const },
              { tier: 4, label: 'Blocked', desc: 'Delete, permission changes', variant: 'ember' as const },
            ].map(t => (
              <div key={t.tier} className="bg-obsidian-800 rounded-xl p-3 border border-white/6">
                <Badge variant={t.variant} className="mb-2 text-[9px]">Tier {t.tier}</Badge>
                <div className="text-xs font-medium text-gray-200">{t.label}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">{t.desc}</div>
              </div>
            ))}
          </div>
        </Card>

        <AgentRoster />
      </div>
    </div>
  )
}
ENDOFFILE

cat > "/home/claude/CognitoBIZ-KeanUHackThis/frontend/src/app/(dashboard)/audit/page.tsx" << 'ENDOFFILE'
'use client'
import { TopBar } from '@/components/layout/TopBar'
import { AuditTimeline } from '@/components/audit/AuditTimeline'
import { Card } from '@/components/ui/Card'
import { ExternalLink, Database, Link2 } from 'lucide-react'

export default function AuditPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Audit Center" subtitle="Complete immutable action history · MongoDB + Solana" />
      <div className="p-6 space-y-5">
        {/* Dual store explanation */}
        <div className="grid grid-cols-2 gap-4">
          <div className="glass rounded-xl border border-white/6 p-4 flex items-start gap-3">
            <Database size={16} className="text-sapphire-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-medium text-white mb-1">MongoDB — Queryable History</div>
              <div className="text-xs text-gray-500">Fast, filterable audit log. Every action, agent call, and approval is written here in real-time.</div>
            </div>
          </div>
          <div className="glass rounded-xl border border-white/6 p-4 flex items-start gap-3">
            <Link2 size={16} className="text-jade-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-medium text-white mb-1">Solana — Tamper-Proof Chain</div>
              <div className="text-xs text-gray-500">
                Every Tier 3+ action gets a Solana memo tx on Devnet. Immutable, verifiable by any third party.{' '}
                <a href="https://explorer.solana.com/?cluster=devnet" target="_blank" rel="noopener" className="text-sapphire-400 hover:text-sapphire-300 inline-flex items-center gap-0.5">
                  Explorer <ExternalLink size={9} />
                </a>
              </div>
            </div>
          </div>
        </div>

        <Card title="Action Timeline" subtitle="All system events ordered by recency">
          <AuditTimeline />
        </Card>
      </div>
    </div>
  )
}