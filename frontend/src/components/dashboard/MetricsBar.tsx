'use client'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, DollarSign, Clock, AlertCircle, BarChart3 } from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/utils'
import type { DashboardMetrics } from '@/types'

interface MetricsBarProps {
  metrics: DashboardMetrics | null
  loading?: boolean
}

export function MetricsBar({ metrics, loading }: MetricsBarProps) {
  const tiles = [
    {
      label: 'Cash Position',
      value: metrics ? formatCurrency(metrics.cashPosition) : '—',
      icon: DollarSign,
      color: 'text-jade-400',
      bg: 'bg-jade-400/8',
      border: 'border-jade-400/15',
      sub: 'Current balance',
    },
    {
      label: 'Monthly Burn',
      value: metrics ? formatCurrency(metrics.monthlyBurn) : '—',
      icon: TrendingDown,
      color: 'text-ember-400',
      bg: 'bg-ember-400/8',
      border: 'border-ember-400/15',
      sub: 'This month',
    },
    {
      label: 'Runway',
      value: metrics ? `${metrics.runway.toFixed(1)} mo` : '—',
      icon: Clock,
      color: metrics && metrics.runway < 6 ? 'text-ember-400' : metrics && metrics.runway < 9 ? 'text-gold-400' : 'text-jade-400',
      bg: metrics && metrics.runway < 6 ? 'bg-ember-400/8' : 'bg-jade-400/8',
      border: metrics && metrics.runway < 6 ? 'border-ember-400/15' : 'border-jade-400/15',
      sub: 'At current burn',
    },
    {
      label: 'MoM Revenue',
      value: metrics ? `${metrics.momRevenueGrowth > 0 ? '+' : ''}${metrics.momRevenueGrowth.toFixed(1)}%` : '—',
      icon: metrics && metrics.momRevenueGrowth >= 0 ? TrendingUp : TrendingDown,
      color: metrics && metrics.momRevenueGrowth >= 0 ? 'text-jade-400' : 'text-ember-400',
      bg: metrics && metrics.momRevenueGrowth >= 0 ? 'bg-jade-400/8' : 'bg-ember-400/8',
      border: metrics && metrics.momRevenueGrowth >= 0 ? 'border-jade-400/15' : 'border-ember-400/15',
      sub: 'vs last month',
    },
    {
      label: 'Pending',
      value: metrics ? String(metrics.pendingApprovalsCount) : '0',
      icon: AlertCircle,
      color: metrics && metrics.pendingApprovalsCount > 0 ? 'text-gold-400' : 'text-gray-500',
      bg: metrics && metrics.pendingApprovalsCount > 0 ? 'bg-gold-400/8' : 'bg-white/4',
      border: metrics && metrics.pendingApprovalsCount > 0 ? 'border-gold-400/15' : 'border-white/8',
      sub: 'Approvals needed',
    },
  ]

  return (
    <div className="grid grid-cols-5 gap-3">
      {tiles.map((tile, i) => (
        <motion.div
          key={tile.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07, duration: 0.4 }}
          className={`glass rounded-2xl p-4 border ${tile.border} transition-all duration-300 hover:scale-[1.02]`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-medium">{tile.label}</span>
            <div className={`w-7 h-7 rounded-lg ${tile.bg} flex items-center justify-center`}>
              <tile.icon size={13} className={tile.color} />
            </div>
          </div>
          {loading ? (
            <div className="h-7 w-24 bg-obsidian-700 rounded-lg animate-pulse" />
          ) : (
            <div className={`text-xl font-display font-semibold ${tile.color}`}>{tile.value}</div>
          )}
          <div className="text-[10px] text-gray-600 mt-1">{tile.sub}</div>
        </motion.div>
      ))}
    </div>
  )
}