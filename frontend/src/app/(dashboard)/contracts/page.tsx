'use client'
import { useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { ContractCard } from '@/components/contracts/ContractCard'
import { ContractCreator } from '@/components/contracts/ContractCreator'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/index'
import { useContracts } from '@/hooks/useContracts'
import { Plus, FileText, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function ContractsPage() {
  const { contracts, loading, createContract, activateContract } = useContracts()
  const [showCreator, setShowCreator] = useState(false)
  const [creating, setCreating] = useState(false)

  const handleCreate = async (description: string, vendorEmail?: string) => {
    setCreating(true)
    try {
      await createContract(description, vendorEmail)
      setShowCreator(false)
    } finally {
      setCreating(false)
    }
  }

  const active = contracts.filter(c => c.status === 'active')
  const draft = contracts.filter(c => c.status === 'draft')
  const completed = contracts.filter(c => c.status === 'completed')

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar
        title="WorkContracts"
        subtitle="Milestone-gated vendor payments · Solana escrow"
      />
      <div className="p-6 space-y-5">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="jade">{active.length} active</Badge>
            <Badge variant="gold">{draft.length} draft</Badge>
            <Badge variant="gray">{completed.length} completed</Badge>
          </div>
          <Button
            variant="gold"
            icon={<Plus size={14} />}
            onClick={() => setShowCreator(true)}
          >
            New WorkContract
          </Button>
        </div>

        {/* Contract Creator */}
        <AnimatePresence>
          {showCreator && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Card title="Generate WorkContract" subtitle="Describe the work — Gemma 4 structures it into milestones">
                <ContractCreator
                  onSubmit={handleCreate}
                  onCancel={() => setShowCreator(false)}
                  loading={creating}
                />
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500">
            <Loader2 size={20} className="animate-spin mr-2" />
            Loading contracts...
          </div>
        ) : contracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText size={40} className="text-gray-700 mb-4" />
            <p className="text-gray-400 font-medium mb-1">No WorkContracts yet</p>
            <p className="text-sm text-gray-600 mb-6">
              Describe a task in plain English — Gemma 4 generates the milestone structure.
            </p>
            <Button variant="gold" icon={<Plus size={14} />} onClick={() => setShowCreator(true)}>
              Create your first contract
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Active */}
            {active.length > 0 && (
              <section>
                <h3 className="text-xs text-gray-500 uppercase tracking-widest mb-3">Active</h3>
                <div className="grid grid-cols-1 gap-4">
                  {active.map(c => (
                    <ContractCard key={c._id} contract={c} onActivate={activateContract} />
                  ))}
                </div>
              </section>
            )}
            {/* Draft */}
            {draft.length > 0 && (
              <section>
                <h3 className="text-xs text-gray-500 uppercase tracking-widest mb-3">Draft — Awaiting Escrow Lock</h3>
                <div className="grid grid-cols-1 gap-4">
                  {draft.map(c => (
                    <ContractCard key={c._id} contract={c} onActivate={activateContract} />
                  ))}
                </div>
              </section>
            )}
            {/* Completed */}
            {completed.length > 0 && (
              <section>
                <h3 className="text-xs text-gray-500 uppercase tracking-widest mb-3">Completed</h3>
                <div className="grid grid-cols-1 gap-4">
                  {completed.map(c => (
                    <ContractCard key={c._id} contract={c} onActivate={activateContract} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}