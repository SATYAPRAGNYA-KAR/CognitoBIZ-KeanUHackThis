'use client'
import { useState, useMemo, useEffect } from 'react'
import { XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Area, AreaChart } from 'recharts'
import { Slider } from '@/components/ui/index'
import { formatCurrency, cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

// Use relative paths so requests go through the Next.js dev server (no CORS, no port issues)

const FALLBACK_BASE = {
  cash: 185420,
  monthlyBurn: 24100,
  monthlyRevenue: 18400,
  momGrowth: 0.08,
}

interface BaseMetrics {
  cash: number
  monthlyBurn: number
  monthlyRevenue: number
  momGrowth: number
}

function buildTimeline(
  base: BaseMetrics,
  params: {
    extraHeadcount: number
    avgSalary: number
    marketingIncrease: number
    awsCut: number
    revenueGrowthAdj: number
  }
) {
  const months = []
  let cash = base.cash
  const extraMonthlyBurn =
    (params.extraHeadcount * params.avgSalary) / 12 +
    params.marketingIncrease -
    base.monthlyBurn * (params.awsCut / 100)

  const totalBurn = base.monthlyBurn + extraMonthlyBurn
  let revenue = base.monthlyRevenue
  const growthRate = base.momGrowth + params.revenueGrowthAdj / 100

  for (let i = 0; i <= 18; i++) {
    months.push({ month: `M+${i}`, cash: Math.max(0, cash), burn: totalBurn, revenue })
    cash = cash - totalBurn + revenue
    revenue = revenue * (1 + growthRate)
    if (cash <= 0) {
      for (let j = i + 1; j <= 18; j++)
        months.push({ month: `M+${j}`, cash: 0, burn: totalBurn, revenue })
      break
    }
  }
  return months
}

// Returns numeric runway month index. 19 = "18+" (never ran out in window)
function getRunwayNum(timeline: ReturnType<typeof buildTimeline>): number {
  const idx = timeline.findIndex((d) => d.cash <= 0)
  return idx === -1 ? 19 : idx
}

function formatRunway(n: number): string {
  return n >= 19 ? '18+' : String(n)
}

export function RunwaySimulator() {
  const [base, setBase] = useState<BaseMetrics | null>(null)
  const [loadingBase, setLoadingBase] = useState(true)
  const [gemmaLoading, setGemmaLoading] = useState(false)
  const [gemmaResult, setGemmaResult] = useState<any>(null)

  const [headcount, setHeadcount] = useState(0)
  const [salary, setSalary] = useState(120)
  const [marketing, setMarketing] = useState(0)
  const [awsCut, setAwsCut] = useState(0)
  const [growthAdj, setGrowthAdj] = useState(0)

  // Seed base metrics from real dashboard API
  useEffect(() => {
    fetch(`/api/dashboard/metrics`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && (data.cash_position || data.burn_rate)) {
          setBase({
            cash: data.cash_position ?? FALLBACK_BASE.cash,
            monthlyBurn: data.burn_rate ?? FALLBACK_BASE.monthlyBurn,
            monthlyRevenue: data.revenue_this_month ?? FALLBACK_BASE.monthlyRevenue,
            momGrowth: Math.max(0, (data.mom_growth_pct ?? 8) / 100),
          })
        } else {
          setBase(FALLBACK_BASE)
        }
      })
      .catch(() => setBase(FALLBACK_BASE))
      .finally(() => setLoadingBase(false))
  }, [])

  const effectiveBase = base ?? FALLBACK_BASE

  const data = useMemo(
    () =>
      buildTimeline(effectiveBase, {
        extraHeadcount: headcount,
        avgSalary: salary * 1000,
        marketingIncrease: marketing * 1000,
        awsCut,
        revenueGrowthAdj: growthAdj,
      }),
    [effectiveBase, headcount, salary, marketing, awsCut, growthAdj]
  )

  const baseData = useMemo(
    () =>
      buildTimeline(effectiveBase, {
        extraHeadcount: 0,
        avgSalary: 0,
        marketingIncrease: 0,
        awsCut: 0,
        revenueGrowthAdj: 0,
      }),
    [effectiveBase]
  )

  const runwayNum = getRunwayNum(data)
  const baseRunwayNum = getRunwayNum(baseData)
  const runwayLabel = formatRunway(runwayNum)
  const baseRunwayLabel = formatRunway(baseRunwayNum)

  const changed = headcount !== 0 || marketing !== 0 || awsCut !== 0 || growthAdj !== 0

  // Safe delta — cap both at 18 before subtracting so we never get NaN
  const cappedRunway = Math.min(runwayNum, 18)
  const cappedBase = Math.min(baseRunwayNum, 18)
  const deltaMonths = cappedRunway - cappedBase
  const runwayWorse = deltaMonths < 0

  const extraBurn =
    (headcount * salary * 1000) / 12 +
    marketing * 1000 -
    effectiveBase.monthlyBurn * (awsCut / 100)

  const runGemmaAnalysis = async () => {
    if (!changed) return
    setGemmaLoading(true)
    setGemmaResult(null)
    try {
      const res = await fetch(`/api/intelligence/runway-simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_hires: headcount,
          hire_salary_annual: salary * 1000,
          revenue_growth_change_pct: growthAdj,
          one_time_expense: 0,
          cost_cut_pct: awsCut,
          current_cash: effectiveBase.cash,
          current_burn: effectiveBase.monthlyBurn,
          current_revenue: effectiveBase.monthlyRevenue,
        }),
      })
      if (res.ok) {
        const d = await res.json()
        setGemmaResult(d.gemma)
      }
    } catch {
      // fail silently — local calc still shown
    } finally {
      setGemmaLoading(false)
    }
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="glass-strong rounded-xl px-3 py-2 text-xs border border-white/10">
        <p className="text-gray-400 mb-1">{label}</p>
        <p className="text-jade-400">Cash: {formatCurrency(payload[0]?.value || 0)}</p>
      </div>
    )
  }

  if (loadingBase) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-gray-500 text-sm">
        <Loader2 size={16} className="animate-spin" />
        Loading your financial baseline…
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Live baseline banner */}
      <div className="flex items-center gap-4 text-[10px] text-gray-500 bg-obsidian-800/40 rounded-lg px-3 py-2">
        <span>
          Cash <span className="text-white font-mono">{formatCurrency(effectiveBase.cash)}</span>
        </span>
        <span>·</span>
        <span>
          Burn <span className="text-white font-mono">{formatCurrency(effectiveBase.monthlyBurn)}/mo</span>
        </span>
        <span>·</span>
        <span>
          Revenue <span className="text-white font-mono">{formatCurrency(effectiveBase.monthlyRevenue)}/mo</span>
        </span>
        <span className="ml-auto text-jade-400/60">live from dashboard</span>
      </div>

      {/* Runway indicator */}
      <div className="flex items-end gap-4">
        <div>
          <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-0.5">
            {changed ? 'Adjusted Runway' : 'Current Runway'}
          </p>
          <p
            className={cn(
              'text-3xl font-display font-bold',
              changed ? (runwayWorse ? 'text-ember-400' : 'text-jade-400') : 'text-white'
            )}
          >
            {runwayLabel}{' '}
            <span className="text-base font-body font-normal text-gray-500">months</span>
          </p>
        </div>

        {/* Only show delta if scenario changed AND there's a real difference */}
        {changed && deltaMonths !== 0 && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn('text-sm pb-1', runwayWorse ? 'text-ember-400' : 'text-jade-400')}
          >
            {runwayWorse ? '↓' : '↑'} {Math.abs(deltaMonths)} mo vs baseline
          </motion.div>
        )}

        {extraBurn !== 0 && (
          <div className="pb-1 ml-auto text-right">
            <p className="text-[10px] text-gray-600">Monthly delta</p>
            <p className={cn('text-sm font-mono font-medium', extraBurn > 0 ? 'text-ember-400' : 'text-jade-400')}>
              {extraBurn > 0 ? '+' : ''}
              {formatCurrency(extraBurn)}/mo
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
            <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 9, fill: '#6b7280' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            {runwayNum < 19 && runwayNum > 0 && (
              <ReferenceLine
                x={`M+${runwayNum}`}
                stroke="#ff6b35"
                strokeDasharray="3 3"
                label={{ value: 'Runout', fill: '#ff6b35', fontSize: 9 }}
              />
            )}
            <Area type="monotone" dataKey="cash" stroke="#f5c842" strokeWidth={2} fill="url(#cashGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Sliders */}
      <div className="space-y-3 pt-2 border-t border-white/6">
        <Slider label="Hire engineers" min={0} max={10} value={headcount} onChange={setHeadcount} formatValue={(v) => `+${v} people`} />
        <Slider label="Avg salary (k/yr)" min={60} max={250} step={10} value={salary} onChange={setSalary} formatValue={(v) => `$${v}k`} />
        <Slider label="Marketing increase" min={0} max={20} step={1} value={marketing} onChange={setMarketing} formatValue={(v) => `+$${v}k/mo`} />
        <Slider label="Cut AWS spend" min={0} max={50} step={5} value={awsCut} onChange={setAwsCut} formatValue={(v) => `-${v}%`} />
        <Slider label="Revenue growth adj." min={-5} max={10} step={0.5} value={growthAdj} onChange={setGrowthAdj} formatValue={(v) => `${v > 0 ? '+' : ''}${v}%`} />
      </div>

      {/* Ask Gemma button */}
      {changed && (
        <button
          onClick={runGemmaAnalysis}
          disabled={gemmaLoading}
          className="w-full text-[11px] py-2 rounded-lg border border-gold-400/20 bg-gold-400/5 text-gold-400 hover:bg-gold-400/10 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {gemmaLoading ? (
            <><Loader2 size={11} className="animate-spin" /> Analysing with Gemma…</>
          ) : (
            '✦ Get Gemma AI analysis of this scenario'
          )}
        </button>
      )}

      {/* Gemma narrative */}
      {gemmaResult && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 rounded-xl bg-gold-400/5 border border-gold-400/10 space-y-2">
          <p className="text-[11px] text-gray-300 leading-relaxed">{gemmaResult.narrative}</p>
          {gemmaResult.critical_date && (
            <p className="text-[10px] text-ember-400">⚠ {gemmaResult.critical_date}</p>
          )}
          {gemmaResult.recommendations?.length > 0 && (
            <ul className="space-y-1 pt-1 border-t border-white/5">
              {gemmaResult.recommendations.map((r: string, i: number) => (
                <li key={i} className="flex items-start gap-1.5 text-[10px] text-gray-400">
                  <span className="text-gold-400 shrink-0">{i + 1}.</span>
                  {r}
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      )}

      {/* Local fallback narrative (before Gemma is called) */}
      {changed && !gemmaResult && !gemmaLoading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 rounded-xl bg-gold-400/5 border border-gold-400/10 text-[11px] text-gray-300 leading-relaxed">
          {cappedRunway < 6
            ? `⚠️ With these changes, runway drops to ${runwayLabel} months — critical. Consider delaying hiring until after your next funding round.`
            : runwayWorse
            ? `Runway contracts from ${baseRunwayLabel} to ${runwayLabel} months. At current MoM growth, you'd need to raise by month ${runwayLabel}. Consider phasing the hire.`
            : `Scenario improves runway from ${baseRunwayLabel} to ${runwayLabel} months. The changes provide meaningful buffer without sacrificing growth levers.`}
        </motion.div>
      )}
    </div>
  )
}