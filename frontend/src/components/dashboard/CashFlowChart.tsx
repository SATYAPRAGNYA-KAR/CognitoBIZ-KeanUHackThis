'use client'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import type { CashFlowPoint } from '@/types'

// Mock data — replaced by API
const MOCK: CashFlowPoint[] = [
  { date: 'Feb 1', inflow: 18000, outflow: 14000 },
  { date: 'Feb 8', inflow: 12000, outflow: 15200 },
  { date: 'Feb 15', inflow: 22000, outflow: 14800 },
  { date: 'Feb 22', inflow: 16000, outflow: 13600 },
  { date: 'Mar 1', inflow: 19000, outflow: 16000 },
  { date: 'Mar 8', inflow: 14000, outflow: 15000 },
  { date: 'Mar 15', inflow: 24000, outflow: 17200 },
  { date: 'Mar 22', inflow: 18000, outflow: 14400 },
  { date: 'Apr 1', inflow: 21000, outflow: 15800 },
  { date: 'Apr 8', inflow: 17000, outflow: 16200 },
  { date: 'Apr 15', inflow: 25000, outflow: 18400 },
  { date: 'Apr 22', inflow: 19000, outflow: 15000 },
  { date: 'May 1', inflow: 20000, outflow: 16000, projected: true },
  { date: 'May 8', inflow: 21000, outflow: 16200, projected: true },
  { date: 'May 15', inflow: 22000, outflow: 16400, projected: true },
]

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-strong rounded-xl px-4 py-3 text-xs border border-white/10">
      <p className="text-gray-400 mb-2 font-medium">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-400 capitalize">{p.name}:</span>
          <span className="text-white font-mono">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

interface CashFlowChartProps {
  data?: CashFlowPoint[]
}

export function CashFlowChart({ data = MOCK }: CashFlowChartProps) {
  const today = 'Apr 22'
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2dd4a0" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#2dd4a0" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ff6b35" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#ff6b35" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={v => `$${v / 1000}k`} tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine x={today} stroke="rgba(245,200,66,0.4)" strokeDasharray="4 4" label={{ value: 'Today', fill: '#f5c842', fontSize: 9, position: 'top' }} />
          <Area type="monotone" dataKey="inflow" stroke="#2dd4a0" strokeWidth={2} fill="url(#inflowGrad)"
            strokeDasharray={(d: any) => d.projected ? '4 4' : '0'} />
          <Area type="monotone" dataKey="outflow" stroke="#ff6b35" strokeWidth={2} fill="url(#outflowGrad)"
            strokeDasharray={(d: any) => d.projected ? '4 4' : '0'} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}