import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/utils'
import type { Contract } from '@/types'

export function useContracts() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchContracts = useCallback(async () => {
    try {
      const data = await apiFetch<{ contracts: any[] }>('/api/contracts')
      setContracts(
        data.contracts.map(c => ({
          _id: c.id,
          companyId: c.company_id || '',
          title: c.title,
          vendorId: c.vendor_id || null,
          vendorEmail: c.vendor_email || '',
          vendorWallet: c.vendor_wallet || null,
          status: c.status,
          totalValue: c.total_value,
          currency: c.currency || 'USD',
          createdAt: c.created_at,
          deadline: c.deadline,
          milestones: [],
          escrowWallet: c.escrow_wallet || null,
          escrowTxInit: c.escrow_tx_init || null,
          totalReleased: c.total_released || 0,
          auditTrail: [],
          marketRateFlag: c.market_rate_flag || null,
          riskFlags: c.risk_flags || [],
        }))
      )
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const getContract = useCallback(async (id: string): Promise<Contract | null> => {
    try {
      const c = await apiFetch<any>(`/api/contracts/${id}`)
      return {
        _id: c.id || c._id,
        companyId: c.company_id || '',
        title: c.title,
        vendorId: c.vendor_id || null,
        vendorEmail: c.vendor_email || '',
        vendorWallet: c.vendor_wallet || null,
        status: c.status,
        totalValue: c.total_value,
        currency: c.currency || 'USD',
        createdAt: c.created_at,
        deadline: c.deadline,
        milestones: (c.milestones || []).map((m: any) => ({
          id: m.id,
          title: m.title,
          description: m.description,
          dueDate: m.due_date,
          value: m.value,
          evidenceRequired: m.evidence_required || [],
          status: m.status,
          evidenceSubmitted: m.evidence_submitted || [],
          gemmaReview: m.gemma_review || null,
          approvedBy: m.approved_by || null,
          approvedAt: m.approved_at || null,
          solanaTx: m.solana_tx || null,
        })),
        escrowWallet: c.escrow_wallet || null,
        escrowTxInit: c.escrow_tx_init || null,
        totalReleased: c.total_released || 0,
        auditTrail: c.audit_trail || [],
        marketRateFlag: c.market_rate_flag || null,
        riskFlags: c.risk_flags || [],
      }
    } catch {
      return null
    }
  }, [])

  const createContract = useCallback(async (description: string, vendorEmail?: string, vendorWallet?: string) => {
    const result = await apiFetch<any>('/api/contracts', {
      method: 'POST',
      body: JSON.stringify({ description, vendor_email: vendorEmail, vendor_wallet: vendorWallet }),
    })
    await fetchContracts()
    return result
  }, [fetchContracts])

  const activateContract = useCallback(async (contractId: string) => {
    const result = await apiFetch<any>(`/api/contracts/${contractId}/activate`, { method: 'POST' })
    await fetchContracts()
    return result
  }, [fetchContracts])

  const approveMilestone = useCallback(async (contractId: string, milestoneId: number) => {
    return apiFetch<any>(`/api/contracts/${contractId}/milestones/${milestoneId}/approve`, {
      method: 'POST',
    })
  }, [])

  useEffect(() => {
    fetchContracts()
  }, [fetchContracts])

  return { contracts, loading, error, fetchContracts, getContract, createContract, activateContract, approveMilestone }
}
