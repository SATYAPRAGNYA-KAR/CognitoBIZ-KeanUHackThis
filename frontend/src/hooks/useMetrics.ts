import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/utils'
import type { DashboardMetrics, CashFlowPoint, ExpenseCategory, AnomalyCard } from '@/types'

export function useMetrics(pollInterval = 60000) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [cashflow, setCashflow] = useState<CashFlowPoint[]>([])
  const [expenses, setExpenses] = useState<ExpenseCategory[]>([])
  const [anomalies, setAnomalies] = useState<AnomalyCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMetrics = useCallback(async () => {
    try {
      const data = await apiFetch<{
        cash_position: number
        burn_rate: number
        runway_months: number
        revenue_this_month: number
        mom_growth_pct: number
        pending_approvals: number
        last_updated: string
      }>('/api/dashboard/metrics')
      setMetrics({
        cashPosition: data.cash_position,
        monthlyBurn: data.burn_rate,
        runway: data.runway_months,
        momRevenueGrowth: data.mom_growth_pct,
        pendingApprovalsCount: data.pending_approvals,
      })
      setError(null)
    } catch (e: any) {
      setError(e.message)
    }
  }, [])

  const fetchCashflow = useCallback(async () => {
    try {
      const data = await apiFetch<{ historical: any[]; projections: any[] }>('/api/dashboard/cashflow')
      const points: CashFlowPoint[] = [
        ...data.historical.map(d => ({ date: d.date, inflow: d.inflow, outflow: d.outflow })),
        ...data.projections.map(d => ({ date: d.date, inflow: d.inflow, outflow: d.outflow, projected: true })),
      ]
      setCashflow(points)
    } catch {}
  }, [])

  const fetchExpenses = useCallback(async () => {
    try {
      const data = await apiFetch<{ categories: { name: string; amount: number; count: number }[] }>(
        '/api/dashboard/expense-breakdown'
      )
      const total = data.categories.reduce((s, c) => s + c.amount, 0)
      setExpenses(
        data.categories.map(c => ({
          category: c.name,
          amount: c.amount,
          percentage: total > 0 ? Math.round((c.amount / total) * 100) : 0,
          trend: 'stable' as const,
        }))
      )
    } catch {}
  }, [])

  const fetchAnomalies = useCallback(async () => {
    try {
      const data = await apiFetch<{ anomalies: any[] }>('/api/dashboard/anomalies')
      setAnomalies(
        data.anomalies.map(a => ({
          _id: a.id,
          transactionId: a.id,
          vendor: a.vendor,
          amount: a.amount,
          avgAmount: a.amount * 0.4,
          category: a.category,
          flagReason: a.flag_reason || '',
          gemmaNote: a.gemma_analysis || '',
          suggestion: a.gemma_analysis || '',
          severity: a.severity as 'high' | 'medium' | 'low',
          date: a.date,
          dismissed: false,
        }))
      )
    } catch {}
  }, [])

  const dismissAnomaly = useCallback(async (transactionId: string) => {
    try {
      await apiFetch(`/api/dashboard/anomalies/${transactionId}/dismiss`, { method: 'POST' })
      setAnomalies(prev => prev.filter(a => a.transactionId !== transactionId))
    } catch {}
  }, [])

  const refetch = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchMetrics(), fetchCashflow(), fetchExpenses(), fetchAnomalies()])
    setLoading(false)
  }, [fetchMetrics, fetchCashflow, fetchExpenses, fetchAnomalies])

  useEffect(() => {
    refetch()
    const interval = setInterval(fetchMetrics, pollInterval)
    return () => clearInterval(interval)
  }, [refetch, fetchMetrics, pollInterval])

  return { metrics, cashflow, expenses, anomalies, loading, error, refetch, dismissAnomaly }
}