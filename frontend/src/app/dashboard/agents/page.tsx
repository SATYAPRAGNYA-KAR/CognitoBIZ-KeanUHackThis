'use client'
import { TopBar } from '@/components/layout/TopBar'
import { AgentRoster } from '@/components/agents/AgentRoster'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/index'
import { Info } from 'lucide-react'

export default function AgentsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Agent Roster" subtitle="Cryptographically-issued AI identities | Auth0 M2M" />
      <div className="p-6 space-y-5">
        <div className="flex items-start gap-3 px-4 py-3 bg-sapphire-400/8 border border-sapphire-400/15 rounded-xl">
          <Info size={14} className="text-sapphire-400 mt-0.5 shrink-0" />
          <p className="text-xs text-gray-400">
            Each agent has an Auth0 machine-to-machine credential with scoped permissions.
            Agents can never act outside their defined role. All Tier 3 and above actions
            require human approval before execution.
          </p>
        </div>

        <Card title="HITL Tier Classification">
          <div className="grid grid-cols-4 gap-3">
            {[
              { tier: 1, label: 'Autonomous', desc: 'Read ops, analysis, drafting', variant: 'gray' as const },
              { tier: 2, label: 'Soft Approval', desc: 'Notifications, status updates', variant: 'jade' as const },
              { tier: 3, label: 'Hard Approval', desc: 'Payments, external comms', variant: 'gold' as const },
              { tier: 4, label: 'Blocked', desc: 'Delete, permission changes', variant: 'ember' as const },
            ].map((tier) => (
              <div key={tier.tier} className="bg-obsidian-800 rounded-xl p-3 border border-white/6">
                <Badge variant={tier.variant} className="mb-2 text-[9px]">
                  Tier {tier.tier}
                </Badge>
                <div className="text-xs font-medium text-gray-200">{tier.label}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">{tier.desc}</div>
              </div>
            ))}
          </div>
        </Card>

        <AgentRoster />
      </div>
    </div>
  )
}
