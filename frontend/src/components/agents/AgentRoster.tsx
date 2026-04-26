'use client'
import { motion } from 'framer-motion'
import { Badge } from '@/components/ui/index'
import { Bot, CheckCircle, XCircle, Clock, Zap } from 'lucide-react'
import { truncateTx } from '@/lib/utils'
import type { Agent } from '@/types'

const MOCK_AGENTS: Agent[] = [
  {
    _id: '1', name: 'CFO Agent', role: 'cfo_agent',
    auth0ClientId: 'cfo-m2m-abc123', status: 'active',
    scopes: ['read:financials', 'read:snowflake', 'draft:reports', 'request:payment'],
    companyId: 'demo', createdAt: new Date().toISOString(), lastActive: new Date().toISOString(),
  },
  {
    _id: '2', name: 'Contract Agent', role: 'contract_agent',
    auth0ClientId: 'contract-m2m-def456', status: 'active',
    scopes: ['read:contracts', 'write:milestones', 'request:payment'],
    companyId: 'demo', createdAt: new Date().toISOString(), lastActive: new Date().toISOString(),
  },
  {
    _id: '3', name: 'Payment Agent', role: 'payment_agent',
    auth0ClientId: 'payment-m2m-ghi789', status: 'idle',
    scopes: ['read:pending_payments', 'execute:payment'],
    companyId: 'demo', createdAt: new Date().toISOString(), lastActive: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    _id: '4', name: 'Audit Agent', role: 'audit_agent',
    auth0ClientId: 'audit-m2m-jkl012', status: 'active',
    scopes: ['read:audit_log', 'draft:reports'],
    companyId: 'demo', createdAt: new Date().toISOString(), lastActive: new Date().toISOString(),
  },
]

// All possible scopes across all agents — green if granted, red if not
const ALL_SCOPES = [
  'read:financials', 'read:snowflake', 'draft:reports', 'request:payment',
  'read:contracts', 'write:milestones', 'execute:payment', 'read:pending_payments',
  'read:audit_log', 'write:transactions', 'delete:any', 'self:modify',
]

const roleColors: Record<string, 'gold' | 'jade' | 'sapphire' | 'gray'> = {
  cfo_agent: 'gold', contract_agent: 'jade', payment_agent: 'sapphire', audit_agent: 'gray',
}

const statusConfig = {
  active: { color: 'text-jade-400', dot: 'bg-jade-400', label: 'Active' },
  idle:   { color: 'text-gray-400', dot: 'bg-gray-500',  label: 'Idle' },
  suspended: { color: 'text-ember-400', dot: 'bg-ember-400', label: 'Suspended' },
}

export function AgentRoster() {
  return (
    <div className="grid grid-cols-2 gap-5">
      {MOCK_AGENTS.map((agent, i) => {
        const st = statusConfig[agent.status]
        return (
          <motion.div
            key={agent._id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="glass rounded-2xl border border-white/6 p-5"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-obsidian-800 border border-white/8 flex items-center justify-center">
                  <Bot size={18} className="text-gray-400" />
                </div>
                <div>
                  <div className="font-semibold text-white text-sm">{agent.name}</div>
                  <Badge variant={roleColors[agent.role] ?? 'gray'} className="mt-1 text-[9px]">
                    {agent.role}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full status-live ${st.dot}`} />
                <span className={`text-[11px] ${st.color}`}>{st.label}</span>
              </div>
            </div>

            {/* Auth0 credential */}
            <div className="bg-obsidian-800 rounded-xl px-3 py-2 mb-4 border border-white/6">
              <div className="text-[9px] text-gray-600 uppercase tracking-widest mb-1">Auth0 M2M Credential</div>
              <div className="flex items-center gap-2">
                <Zap size={10} className="text-gold-400" />
                <span className="font-mono text-[11px] text-gray-400">{truncateTx(agent.auth0ClientId, 8)}</span>
                <Badge variant="jade" className="ml-auto text-[9px]">Valid</Badge>
              </div>
            </div>

            {/* Permissions */}
            <div>
              <div className="text-[9px] text-gray-600 uppercase tracking-widest mb-2">Permissions</div>
              <div className="space-y-1">
                {ALL_SCOPES.map(scope => {
                  const granted = agent.scopes.includes(scope)
                  const isDanger = scope === 'delete:any' || scope === 'self:modify'
                  return (
                    <div key={scope} className="flex items-center gap-2">
                      {granted
                        ? <CheckCircle size={11} className="text-jade-400 shrink-0" />
                        : <XCircle size={11} className={`shrink-0 ${isDanger ? 'text-ember-400/40' : 'text-gray-700'}`} />
                      }
                      <span className={`text-[11px] font-mono ${granted ? 'text-gray-300' : isDanger ? 'text-ember-400/40' : 'text-gray-700'}`}>
                        {scope}
                      </span>
                      {isDanger && !granted && (
                        <Badge variant="ember" className="text-[8px] ml-auto">Blocked</Badge>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Last active */}
            <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-white/6">
              <Clock size={10} className="text-gray-600" />
              <span className="text-[10px] text-gray-600">
                Last active: {new Date(agent.lastActive).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}