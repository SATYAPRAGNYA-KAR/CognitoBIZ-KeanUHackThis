'use client'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import type { ExpenseCategory } from '@/types'
import { TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react'

const MOCK: ExpenseCategory[] = [
  { category: 'Infrastructure', amount: 8200, percentage: 34, trend: 'up' },
  { category: 'Payroll', amount: 13000, percentage: 54, trend: 'stable' },
  { category: 'Marketing', amount: 1200, percentage: 5, trend: 'down' },
  { category: 'Legal', amount: 400, percentage: 2, trend: 'stable' },
  { category: 'Software', amount: 1000, percentage: 4, trend: 'up' },
  { category: 'Other', amount: 200, percentage: 1, trend: 'stable' },
]

const COLORS = ['#60a5fa', '#f5c842', '#2dd4a0', '#ff6b35', '#a78bfa', '#6b7280']

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="glass-strong rounded-xl px-3 py-2 text-xs border border-white/10">
      <p className="text-white font-medium">{d.category}</p>
      <p className="text-gray-400">{formatCurrency(d.amount)} · {d.percentage}%</p>
    </div>
  )
}

const TrendIcon = ({ trend }: { trend: string }) => {
  if (trend === 'up') return <TrendingUp size={10} className="text-ember-400" />
  if (trend === 'down') return <TrendingDown size={10} className="text-jade-400" />
  return <Minus size={10} className="text-gray-500" />
}

interface ExpenseBreakdownProps {
  data?: ExpenseCategory[]
  loading?: boolean
}

export function ExpenseBreakdown({ data, loading }: ExpenseBreakdownProps) {
  const displayData = (data && data.length > 0) ? data : MOCK
  const total = displayData.reduce((s, d) => s + d.amount, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 size={20} className="animate-spin text-gray-600" />
      </div>
    )
  }

  return (
    <div className="flex gap-4 items-center">
      {/* Donut */}
      <div className="w-32 h-32 shrink-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={displayData} cx="50%" cy="50%" innerRadius={38} outerRadius={56}
              dataKey="amount" strokeWidth={0}>
              {displayData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] text-gray-500">Total</span>
          <span className="text-xs font-mono font-medium text-white">{formatCurrency(total)}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex-1 space-y-1.5">
        {displayData.map((d, i) => (
          <div key={d.category} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="text-[11px] text-gray-400 flex-1 truncate">{d.category}</span>
            <TrendIcon trend={d.trend} />
            <span className="text-[11px] text-gray-300 font-mono w-12 text-right">{d.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}