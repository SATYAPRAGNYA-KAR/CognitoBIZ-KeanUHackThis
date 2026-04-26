'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/index'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency, cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus, ExternalLink, Loader2 } from 'lucide-react'
import type { BenchmarkResult } from '@/types'

// Calls go through the Next.js proxy route — no direct backend calls from the browser

const statusConfig = {
  above: { color: '#ff6b35', icon: TrendingUp, label: 'Above peers', badgeVariant: 'ember' as const },
  below: { color: '#2dd4a0', icon: TrendingDown, label: 'Below peers', badgeVariant: 'jade' as const },
  'on-par': { color: '#6b7280', icon: Minus, label: 'On par', badgeVariant: 'gray' as const },
  on_par: { color: '#6b7280', icon: Minus, label: 'On par', badgeVariant: 'gray' as const },
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-strong rounded-xl px-3 py-2 text-xs border border-white/10 space-y-1">
      <p className="text-gray-400 font-medium">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
          <span className="text-gray-400 capitalize">{p.name}:</span>
          <span className="text-white font-mono">{typeof p.value === 'number' && p.value > 100 ? formatCurrency(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

function normaliseBenchmarkResponse(data: any): BenchmarkResult {
  const analysis = data.analysis || {}
  const categories = (analysis.categories || []).map((c: any) => {
    const rawStatus = (c.status || 'on_par').replace('_', '-') as 'above' | 'below' | 'on-par'
    return {
      category: c.name,
      yourValue: c.company_value ?? 0,
      peerAvg: c.peer_avg ?? 0,
      unit: c.company_value > 100 ? '/mo' : '%',
      status: rawStatus,
      delta: Math.round(c.variance_pct ?? 0),
    }
  })

  // If API returned no categories (empty company spend), build from peer data directly
  // so the chart is still useful
  const peerFallback = Object.entries(data.peer_data || {}).map(([name, vals]: any) => ({
    category: name,
    yourValue: 0,
    peerAvg: vals.avg ?? 0,
    unit: '/mo',
    status: 'below' as const,
    delta: -100,
  }))

  return {
    metrics: categories.length > 0 ? categories : peerFallback,
    narrative: analysis.narrative || 'No narrative available.',
    recommendations: analysis.top_recommendations || [],
    dataSource: `Snowflake Marketplace · ${data.industry ?? 'SaaS'} · ${data.stage ?? 'seed'} stage`,
  }
}

export function BenchmarkView() {
  const [result, setResult] = useState<BenchmarkResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runBenchmark = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/intelligence/benchmark')
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data = await res.json()
      setResult(normaliseBenchmarkResponse(data))
    } catch (e: any) {
      setError(e.message || 'Failed to load benchmark data')
    } finally {
      setLoading(false)
    }
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-16 h-16 rounded-2xl border border-sapphire-400/20 bg-sapphire-400/5 flex items-center justify-center">
          <TrendingUp size={28} className="text-sapphire-400/60" />
        </div>
        <div className="text-center">
          <p className="text-white font-medium mb-1">Peer Benchmarking</p>
          <p className="text-gray-500 text-sm max-w-xs">Compare your metrics against seed-stage SaaS companies using live Snowflake Marketplace data.</p>
        </div>
        {error && <p className="text-ember-400 text-xs">{error}</p>}
        <Button variant="gold" loading={loading} onClick={runBenchmark} icon={<TrendingUp size={14} />}>
          Run Benchmark Analysis
        </Button>
        <p className="text-[10px] text-gray-600">Data via Snowflake · Economic Indicators · SEC Filings</p>
      </div>
    )
  }

  const chartData = result.metrics.map(m => ({
    category: m.category,
    You: m.yourValue,
    'Peer Avg': m.peerAvg,
  }))

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      {/* Chart */}
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ left: -20, bottom: 0 }}>
            <XAxis dataKey="category" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={v => v > 999 ? `$${(v/1000).toFixed(0)}k` : String(v)} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="You" radius={[4, 4, 0, 0]} fill="#f5c842" fillOpacity={0.8} />
            <Bar dataKey="Peer Avg" radius={[4, 4, 0, 0]} fill="#3b82f6" fillOpacity={0.5} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 justify-center mt-1">
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500"><span className="w-2.5 h-1.5 rounded bg-gold-400" />You</div>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500"><span className="w-2.5 h-1.5 rounded bg-sapphire-500/50" />Peer Avg</div>
        </div>
      </div>

      {/* Metric rows */}
      <div className="space-y-2">
        {result.metrics.map((m, i) => {
          const statusKey = m.status.replace('_', '-') as keyof typeof statusConfig
          const cfg = statusConfig[statusKey] || statusConfig['on-par']
          return (
            <motion.div key={m.category} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-obsidian-800/40 transition-colors">
              <cfg.icon size={13} style={{ color: cfg.color }} className="shrink-0" />
              <span className="text-xs text-gray-300 flex-1">{m.category}</span>
              <span className="text-xs font-mono text-white">{m.yourValue > 100 ? formatCurrency(m.yourValue) : m.yourValue}{m.unit}</span>
              <span className="text-[10px] text-gray-500">vs</span>
              <span className="text-xs font-mono text-gray-400">{m.peerAvg > 100 ? formatCurrency(m.peerAvg) : m.peerAvg}{m.unit}</span>
              <Badge variant={cfg.badgeVariant}>{m.delta > 0 ? '+' : ''}{m.delta}%</Badge>
            </motion.div>
          )
        })}
      </div>

      {/* Narrative */}
      <div className="p-3 rounded-xl bg-sapphire-400/5 border border-sapphire-400/10">
        <p className="text-[11px] text-gray-300 leading-relaxed">{result.narrative}</p>
      </div>

      {/* Recommendations */}
      {result.recommendations.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] text-gray-600 uppercase tracking-widest">Top Recommendations</span>
          {result.recommendations.map((r, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-gold-400 text-[10px] mt-0.5 shrink-0">{i + 1}.</span>
              <p className="text-[11px] text-gray-400">{r}</p>
            </div>
          ))}
        </div>
      )}

      {/* Data source */}
      <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
        <ExternalLink size={10} />
        <span>{result.dataSource}</span>
        <button onClick={() => setResult(null)} className="ml-auto text-gray-600 hover:text-gold-400 transition-colors">Re-run</button>
      </div>
    </motion.div>
  )
}