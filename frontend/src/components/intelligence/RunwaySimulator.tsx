'use client'
import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Area, AreaChart } from 'recharts'
import { Slider } from '@/components/ui/index'
import { formatCurrency, cn } from '@/lib/utils'
import { motion } from 'framer-motion'

const BASE = {
  cash: 287400,
  monthlyBurn: 24100,
  monthlyRevenue: 18400,
  momGrowth: 0.083,
}

function buildTimeline(params: {
  extraHeadcount: number
  avgSalary: number
  marketingIncrease: number
  awsCut: number
  revenueGrowthAdj: number
}) {
  const months = []
  let cash = BASE.cash
  const baseBurn = BASE.monthlyBurn
  const extraMonthlyBurn = (params.extraHeadcount * params.avgSalary) / 12
    + params.marketingIncrease
    - (baseBurn * params.awsCut / 100)

  const totalBurn = baseBurn + extraMonthlyBurn
  let revenue = BASE.monthlyRevenue
  const growthRate = BASE.momGrowth + params.revenueGrowthAdj / 100

  for (let i = 0; i <= 18; i++) {
    months.push({ month: `M+${i}`, cash: Math.max(0, cash), burn: totalBurn, revenue })
    cash = cash - totalBurn + revenue
    revenue = revenue * (1 + growthRate)
    if (cash <= 0) {
      for (let j = i + 1; j <= 18; j++) months.push({ month: `M+${j}`, cash: 0, burn: totalBurn, revenue })
      break
    }
  }
  return months
}

export function RunwaySimulator() {
  const [headcount, setHeadcount] = useState(0)
  const [salary, setSalary] = useState(120)
  const [marketing, setMarketing] = useState(0)
  const [awsCut, setAwsCut] = useState(0)
  const [growthAdj, setGrowthAdj] = useState(0)

  const data = useMemo(() => buildTimeline({
    extraHeadcount: headcount,
    avgSalary: salary * 1000,
    marketingIncrease: marketing * 1000,
    awsCut,
    revenueGrowthAdj: growthAdj,
  }), [headcount, salary, marketing, awsCut, growthAdj])

  const baseData = useMemo(() => buildTimeline({ extraHeadcount: 0, avgSalary: 0, marketingIncrease: 0, awsCut: 0, revenueGrowthAdj: 0 }), [])

  const runoutMonth = data.findIndex(d => d.cash <= 0)
  const baseRunout = baseData.findIndex(d => d.cash <= 0)
  const runwayMonths = runoutMonth === -1 ? '18+' : String(runoutMonth)
  const baseRunwayMonths = baseRunout === -1 ? '18+' : String(baseRunout)
  const changed = runwayMonths !== baseRunwayMonths

  const extraBurn = (headcount * salary * 1000 / 12) + (marketing * 1000) - (BASE.monthlyBurn * awsCut / 100)

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="glass-strong rounded-xl px-3 py-2 text-xs border border-white/10">
        <p className="text-gray-400 mb-1">{label}</p>
        <p className="text-jade-400">Cash: {formatCurrency(payload[0]?.value || 0)}</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Runway indicator */}
      <div className="flex items-end gap-4">
        <div>
          <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-0.5">Adjusted Runway</p>
          <p className={cn('text-3xl font-display font-bold', changed ? (Number(runwayMonths) < Number(baseRunwayMonths) ? 'text-ember-400' : 'text-jade-400') : 'text-white')}>
            {runwayMonths} <span className="text-base font-body font-normal text-gray-500">months</span>
          </p>
        </div>
        {changed && (
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
            className={cn('text-sm pb-1', Number(runwayMonths) < Number(baseRunwayMonths) ? 'text-ember-400' : 'text-jade-400')}>
            {Number(runwayMonths) < Number(baseRunwayMonths) ? '↓' : '↑'} {Math.abs(Number(runwayMonths) - Number(baseRunwayMonths))} mo vs baseline
          </motion.div>
        )}
        {extraBurn !== 0 && (
          <div className="pb-1 ml-auto text-right">
            <p className="text-[10px] text-gray-600">Monthly delta</p>
            <p className={cn('text-sm font-mono font-medium', extraBurn > 0 ? 'text-ember-400' : 'text-jade-400')}>
              {extraBurn > 0 ? '+' : ''}{formatCurrency(extraBurn)}/mo
            </p>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: -20, right: 4, top: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f5c842" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#f5c842" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#6b7280' }} axisLine={false} tickLine={false} interval={2} />
            <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 9, fill: '#6b7280' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            {runoutMonth > 0 && <ReferenceLine x={`M+${runoutMonth}`} stroke="#ff6b35" strokeDasharray="3 3" label={{ value: 'Runout', fill: '#ff6b35', fontSize: 9 }} />}
            <Area type="monotone" dataKey="cash" stroke="#f5c842" strokeWidth={2} fill="url(#cashGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Sliders */}
      <div className="space-y-3 pt-2 border-t border-white/6">
        <Slider label="Hire engineers" min={0} max={10} value={headcount} onChange={setHeadcount}
          formatValue={v => `+${v} people`} />
        <Slider label="Avg salary (k/yr)" min={60} max={250} step={10} value={salary} onChange={setSalary}
          formatValue={v => `$${v}k`} />
        <Slider label="Marketing increase" min={0} max={20} step={1} value={marketing} onChange={setMarketing}
          formatValue={v => `+$${v}k/mo`} />
        <Slider label="Cut AWS spend" min={0} max={50} step={5} value={awsCut} onChange={setAwsCut}
          formatValue={v => `-${v}%`} />
        <Slider label="Revenue growth adj." min={-5} max={10} step={0.5} value={growthAdj} onChange={setGrowthAdj}
          formatValue={v => `${v > 0 ? '+' : ''}${v}%`} />
      </div>

      {/* Gemma narrative */}
      {changed && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="p-3 rounded-xl bg-gold-400/5 border border-gold-400/10 text-[11px] text-gray-300 leading-relaxed">
          {Number(runwayMonths) < 6
            ? `⚠️ With these changes, runway drops to ${runwayMonths} months — critical. Consider delaying hiring until after your next funding round.`
            : Number(runwayMonths) < Number(baseRunwayMonths)
            ? `Runway contracts from ${baseRunwayMonths} to ${runwayMonths} months. At current MoM growth, you'd need to raise by month ${runwayMonths}. Consider phasing the hire.`
            : `Scenario improves runway from ${baseRunwayMonths} to ${runwayMonths} months. The cost reductions provide meaningful buffer without sacrificing growth levers.`}
        </motion.div>
      )}
    </div>
  )
}