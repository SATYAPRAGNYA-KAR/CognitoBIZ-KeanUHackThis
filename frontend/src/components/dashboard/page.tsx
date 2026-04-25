'use client'
import { useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { MetricsBar } from '@/components/dashboard/MetricsBar'
import { CashFlowChart } from '@/components/dashboard/CashFlowChart'
import { ExpenseBreakdown } from '@/components/dashboard/ExpenseBreakdown'
import { AnomalyFeed } from '@/components/dashboard/AnomalyFeed'
import { BriefingPlayer } from '@/components/dashboard/BriefingPlayer'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/index'
import { Toaster } from 'react-hot-toast'
import type { DashboardMetrics } from '@/types'
import { RefreshCw } from 'lucide-react'

const MOCK_METRICS: DashboardMetrics = {
  cashPosition: 287400,
  monthlyBurn: 24100,
  runway: 11.2,
  momRevenueGrowth: 8.3,
  pendingApprovalsCount: 3,
  lastUpdated: new Date().toISOString(),
}

export default function DashboardPage() {
  const [metrics] = useState<DashboardMetrics>(MOCK_METRICS)
  const [loading] = useState(false)

  return (
    <div className="min-h-screen">
      <TopBar title="Dashboard" subtitle="Financial overview & live pulse" />
      <Toaster position="bottom-right" toastOptions={{
        style: { background: '#141820', border: '1px solid rgba(255,255,255,0.08)', color: '#e8eaf0' }
      }} />

      <div className="p-6 space-y-5">
        {/* Metrics Bar */}
        <MetricsBar metrics={metrics} loading={loading} />

        {/* Row 2: Cash Flow + Morning Briefing */}
        <div className="grid grid-cols-3 gap-5">
          {/* Cash Flow */}
          <Card className="col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Cash Flow</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                    <span className="w-2 h-0.5 bg-jade-400 rounded" />inflow
                    <span className="w-2 h-0.5 bg-ember-400 rounded ml-1" />outflow
                    <span className="w-2 h-0.5 bg-gray-600 rounded border-dashed ml-1" />projected
                  </div>
                  <button className="text-gray-600 hover:text-gray-400 transition-colors">
                    <RefreshCw size={12} />
                  </button>
                </div>
              </div>
            </CardHeader>
            <CashFlowChart />
          </Card>

          {/* Morning Briefing */}
          <Card glow="gold">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Morning Briefing</CardTitle>
                <Badge variant="gold" dot>Live</Badge>
              </div>
              <p className="text-[10px] text-gray-600 mt-0.5">Powered by ElevenLabs</p>
            </CardHeader>
            <BriefingPlayer />
          </Card>
        </div>

        {/* Row 3: Expenses + Anomalies */}
        <div className="grid grid-cols-3 gap-5">
          {/* Expense Breakdown */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Expenses</CardTitle>
                <span className="text-[10px] text-gray-600">April 2025</span>
              </div>
            </CardHeader>
            <ExpenseBreakdown />

            {/* Recurring highlight */}
            <div className="mt-4 pt-3 border-t border-white/6 space-y-1.5">
              <span className="text-[10px] text-gray-600 uppercase tracking-widest">Recurring</span>
              {[
                { name: 'Figma', amount: 480, status: '⚠️ 3 inactive users', warn: true },
                { name: 'AWS', amount: 3400, status: '⚠️ Spike detected', warn: true },
                { name: 'Slack', amount: 320, status: '✓ All active', warn: false },
              ].map(r => (
                <div key={r.name} className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-gray-300">{r.name}</span>
                    <span className={`text-[10px] ml-2 ${r.warn ? 'text-gold-400' : 'text-jade-400'}`}>{r.status}</span>
                  </div>
                  <span className="text-[11px] font-mono text-gray-400">${r.amount}/mo</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Anomaly Feed */}
          <Card className="col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Anomaly Detection</CardTitle>
                <Badge variant="gold">3 flagged</Badge>
              </div>
              <p className="text-[10px] text-gray-600 mt-0.5">Gemma 4 analysis · auto-refreshes hourly</p>
            </CardHeader>
            <AnomalyFeed />
          </Card>
        </div>
      </div>
    </div>
  )
}