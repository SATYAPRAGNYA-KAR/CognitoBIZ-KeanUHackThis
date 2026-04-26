'use client'
import { TopBar } from '@/components/layout/TopBar'
import { MetricsBar } from '@/components/dashboard/MetricsBar'
import { CashFlowChart } from '@/components/dashboard/CashFlowChart'
import { AnomalyFeed } from '@/components/dashboard/AnomalyFeed'
import { ExpenseBreakdown } from '@/components/dashboard/ExpenseBreakdown'
import { BriefingPlayer } from '@/components/dashboard/BriefingPlayer'
import { Card } from '@/components/ui/Card'
import { useMetrics } from '@/hooks/useMetrics'

export default function DashboardPage() {
  const { metrics, cashflow, expenses, anomalies, loading, error, refetch, dismissAnomaly } = useMetrics()

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Financial Pulse" subtitle="Live view · Updated just now" />
      <div className="p-6 space-y-5 flex-1">
        {/* Metrics strip */}
        <MetricsBar metrics={metrics} loading={loading} />

        {/* Cash flow + Briefing */}
        <div className="grid grid-cols-3 gap-5">
          <Card className="col-span-2" title="Cash Flow Timeline" subtitle="90-day history + 30-day projection">
            <CashFlowChart data={cashflow} loading={loading} />
          </Card>
          <Card title="Morning Briefing" subtitle="Powered by Gemma 4 + ElevenLabs">
            <BriefingPlayer />
          </Card>
        </div>

        {/* Expense + Anomalies */}
        <div className="grid grid-cols-3 gap-5">
          <Card title="Expense Breakdown" subtitle="This month by category">
            <ExpenseBreakdown data={expenses} loading={loading} />
          </Card>
          <Card className="col-span-2" title="Anomaly Detection" subtitle="AI-flagged financial events">
            <AnomalyFeed anomalies={anomalies} loading={loading} onDismiss={dismissAnomaly} />
          </Card>
        </div>
      </div>
    </div>
  )
}