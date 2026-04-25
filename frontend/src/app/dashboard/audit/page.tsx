'use client'
import { TopBar } from '@/components/layout/TopBar'
import { AuditTimeline } from '@/components/audit/AuditTimeline'
import { Card } from '@/components/ui/Card'
import { ExternalLink, Database, Link2 } from 'lucide-react'

export default function AuditPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <TopBar
        title="Audit Center"
        subtitle="Complete immutable action history · MongoDB + Solana Devnet"
      />
      <div className="p-6 space-y-5">
        {/* Dual store explanation */}
        <div className="grid grid-cols-2 gap-4">
          <div className="glass rounded-xl border border-white/6 p-4 flex items-start gap-3">
            <Database size={16} className="text-sapphire-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-medium text-white mb-1">MongoDB — Queryable History</div>
              <div className="text-xs text-gray-500">
                Fast, filterable audit log. Every action, agent call, and approval is written here in real-time.
              </div>
            </div>
          </div>
          <div className="glass rounded-xl border border-white/6 p-4 flex items-start gap-3">
            <Link2 size={16} className="text-jade-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-medium text-white mb-1">Solana — Tamper-Proof Chain</div>
              <div className="text-xs text-gray-500">
                Every Tier 3+ action gets a Solana memo tx on Devnet. Immutable, verifiable by any third party.{' '}
                <a
                  href="https://explorer.solana.com/?cluster=devnet"
                  target="_blank"
                  rel="noopener"
                  className="text-sapphire-400 hover:text-sapphire-300 inline-flex items-center gap-0.5"
                >
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