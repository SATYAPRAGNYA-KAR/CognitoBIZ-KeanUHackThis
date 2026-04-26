// ─── Dashboard ─────────────────────────────────────────────────────────────
export interface DashboardMetrics {
  cashPosition: number
  monthlyBurn: number
  runway: number
  momRevenueGrowth: number
  pendingApprovalsCount: number
  lastUpdated?: string   // ← Add this
}

export interface CashFlowPoint {
  date: string
  inflow: number
  outflow: number
  projected?: boolean
}

export interface ExpenseCategory {
  category: string
  amount: number
  percentage: number
  trend: 'up' | 'down' | 'stable'
}

export interface AnomalyCard {
  _id: string
  transactionId: string
  vendor: string
  amount: number
  avgAmount: number
  category: string
  flagReason: string
  gemmaNote: string
  suggestion: string
  severity: 'high' | 'medium' | 'low'
  date: string
  dismissed: boolean
}

// ─── Agents ──────────────────────────────────────────────────────────────────
export interface Agent {
  _id: string
  name: string
  role: 'cfo_agent' | 'contract_agent' | 'audit_agent' | 'payment_agent'
  auth0ClientId: string
  scopes: string[]
  companyId: string
  createdAt: string
  lastActive: string
  status: 'active' | 'idle' | 'suspended'
}

// ─── Contracts ───────────────────────────────────────────────────────────────
export type MilestoneStatus = 'pending' | 'submitted' | 'under_review' | 'approved' | 'revision_requested' | 'paid'
export type ContractStatus = 'draft' | 'active' | 'completed' | 'disputed' | 'cancelled'

export interface Milestone {
  id: number
  title: string
  description: string
  dueDate: string
  value: number
  evidenceRequired: string[]
  status: MilestoneStatus
  evidenceSubmitted: string[]
  gemmaReview: GemmaReview | null
  approvedBy: string | null
  approvedAt: string | null
  solanaTx: string | null
}

export interface GemmaReview {
  checks: { label: string; passed: boolean; note?: string }[]
  recommendation: string
  confidence: 'high' | 'medium' | 'low'
  overallPass: boolean
}

export interface Contract {
  _id: string
  companyId: string
  title: string
  vendorId: string | null
  vendorEmail: string
  status: ContractStatus
  totalValue: number
  currency: string
  createdAt: string
  deadline: string
  milestones: Milestone[]
  escrowWallet: string | null
  escrowTxInit: string | null
  totalReleased: number
  auditTrail: AuditEntry[]
  marketRateFlag: string | null
  riskFlags: string[]
}

// ─── Audit ───────────────────────────────────────────────────────────────────
export interface AuditEntry {
  _id: string
  companyId: string
  timestamp: string
  actionType: string
  agentId: string | null
  agentRole: string | null
  humanActor: string | null
  payload: Record<string, unknown>
  tier: 1 | 2 | 3 | 4
  hitlRequired: boolean
  hitlApprovedBy: string | null
  hitlApprovedAt: string | null
  solanaTx: string | null
  solanaMemo: string | null
  status: 'completed' | 'pending' | 'blocked'
}

// ─── Guardrails ───────────────────────────────────────────────────────────────
export type GuardrailSeverity = 'blocked' | 'goodhart' | 'gated' | 'approved'

export interface GuardrailEvent {
  _id: string
  companyId: string
  timestamp: string
  severity: GuardrailSeverity
  tier: number
  agentRole: string
  attemptedAction: string
  reason: string
  solanaTx: string | null
  outcome: string
}

// ─── Payments ────────────────────────────────────────────────────────────────
export interface PendingPayment {
  _id: string
  type: 'invoice' | 'milestone' | 'recurring'
  vendor: string
  amount: number
  dueDate: string
  gemmaNote: string
  gemmaConfidence: 'high' | 'medium' | 'low'
  contractId?: string
  milestoneId?: number
  status: 'pending' | 'approved' | 'rejected'
}

// ─── Intelligence ─────────────────────────────────────────────────────────────
export interface BenchmarkRow {
  category: string
  yourSpend: number
  peerAvg: number
  peerP25: number
  peerP75: number
  delta: number
  status: 'above' | 'below' | 'on-par'
}

export interface BenchmarkMetric {
  category: string
  yourValue: number
  peerAvg: number
  unit: string
  delta: number
  status: 'above' | 'below' | 'on-par'
}

export interface BenchmarkResult {
  metrics: BenchmarkMetric[]
  narrative: string
  recommendations: string[]
  dataSource: string
}

export interface DocumentExtraction {
  _id: string
  filename: string
  type: 'invoice' | 'contract' | 'proposal' | 'other'
  uploadedAt: string
  extractedData: {
    vendor?: string
    amount?: number
    dueDate?: string
    paymentTerms?: string
    flags?: string[]
    [key: string]: unknown
  }
  gemmaSummary: string
  status: 'extracted' | 'reviewed' | 'action_taken'
}

// ─── Notifications ────────────────────────────────────────────────────────────
export interface Notification {
  _id: string
  companyId: string
  userId?: string
  type: 'approval_required' | 'anomaly' | 'milestone_submitted' | 'payment_released' | 'renewal' | 'guardrail' | 'hitl' | 'payment' | 'milestone'
  title: string
  message: string
  severity?: 'info' | 'success' | 'warning' | 'error'
  read: boolean
  createdAt: string
  link?: string
}
