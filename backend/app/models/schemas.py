from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum
import uuid


def new_id() -> str:
    return str(uuid.uuid4())


# ─── Enums ───────────────────────────────────────────────────────────────────

class UserRole(str, Enum):
    owner = "owner"
    team_member = "team_member"
    vendor = "vendor"
    auditor = "auditor"


class AgentRole(str, Enum):
    cfo_agent = "cfo_agent"
    contract_agent = "contract_agent"
    audit_agent = "audit_agent"
    payment_agent = "payment_agent"


class ActionTier(int, Enum):
    tier1 = 1  # Autonomous
    tier2 = 2  # Soft approval
    tier3 = 3  # Hard approval
    tier4 = 4  # Blocked


class MilestoneStatus(str, Enum):
    pending = "pending"
    submitted = "submitted"
    under_review = "under_review"
    approved = "approved"
    revision_requested = "revision_requested"
    paid = "paid"


class ContractStatus(str, Enum):
    draft = "draft"
    active = "active"
    completed = "completed"
    cancelled = "cancelled"


class ApprovalStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


# ─── Company ─────────────────────────────────────────────────────────────────

class CompanySettings(BaseModel):
    briefing_time: str = "08:00"
    approval_threshold_usd: float = 500.0
    guardrails_enabled: bool = True


class Company(BaseModel):
    id: str = Field(default_factory=new_id, alias="_id")
    name: str
    industry: str
    stage: str  # bootstrapped | pre-seed | seed | series-a
    team_size: int
    monthly_revenue_range: str
    currency: str = "USD"
    fiscal_year_start: int = 1
    owner_user_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    settings: CompanySettings = Field(default_factory=CompanySettings)

    class Config:
        populate_by_name = True


# ─── User ─────────────────────────────────────────────────────────────────────

class User(BaseModel):
    id: str = Field(default_factory=new_id, alias="_id")
    auth0_id: str
    email: str
    role: UserRole
    company_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None

    class Config:
        populate_by_name = True


# ─── Agent ────────────────────────────────────────────────────────────────────

class Agent(BaseModel):
    id: str = Field(default_factory=new_id, alias="_id")
    name: str
    role: AgentRole
    auth0_client_id: str = ""
    scopes: List[str] = []
    company_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_active: Optional[datetime] = None
    is_active: bool = True

    class Config:
        populate_by_name = True


# ─── Transaction ─────────────────────────────────────────────────────────────

class Transaction(BaseModel):
    id: str = Field(default_factory=new_id, alias="_id")
    company_id: str
    amount: float  # negative = expense, positive = income
    category: str = "Miscellaneous"
    subcategory: Optional[str] = None
    vendor: Optional[str] = None
    date: str  # YYYY-MM-DD
    source: str = "manual"  # plaid | csv | manual | demo
    plaid_transaction_id: Optional[str] = None
    status: str = "active"
    flagged: bool = False
    flag_reason: Optional[str] = None
    is_recurring: bool = False
    gemma_analysis: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True


# ─── Document ─────────────────────────────────────────────────────────────────

class ExtractedData(BaseModel):
    vendor: Optional[str] = None
    amount: Optional[float] = None
    due_date: Optional[str] = None
    payment_terms: Optional[str] = None
    flags: List[str] = []
    raw: Optional[Any] = None


class Document(BaseModel):
    id: str = Field(default_factory=new_id, alias="_id")
    company_id: str
    filename: str
    file_type: str  # invoice | contract | proposal | bank_statement | other
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    extracted_data: Optional[ExtractedData] = None
    gemma_summary: Optional[str] = None
    status: str = "uploaded"  # uploaded | processing | reviewed
    action_taken: Optional[str] = None

    class Config:
        populate_by_name = True


# ─── Contracts / WorkContracts ────────────────────────────────────────────────

class EvidenceItem(BaseModel):
    type: str  # link | file
    url: Optional[str] = None
    filename: Optional[str] = None
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)


class GemmaReview(BaseModel):
    assessment: str
    checks: List[dict] = []
    recommendation: str
    confidence: str  # High | Medium | Low
    reviewed_at: datetime = Field(default_factory=datetime.utcnow)


class Milestone(BaseModel):
    id: int
    title: str
    description: str
    due_date: Optional[str] = None
    value: float
    evidence_required: List[str] = []
    status: MilestoneStatus = MilestoneStatus.pending
    evidence_submitted: List[EvidenceItem] = []
    gemma_review: Optional[GemmaReview] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    solana_tx: Optional[str] = None


class AuditEntry(BaseModel):
    event: str
    actor: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    solana_tx: Optional[str] = None
    metadata: Optional[dict] = None


class Contract(BaseModel):
    id: str = Field(default_factory=new_id, alias="_id")
    company_id: str
    title: str
    vendor_id: Optional[str] = None
    vendor_email: Optional[str] = None
    vendor_wallet: Optional[str] = None
    status: ContractStatus = ContractStatus.draft
    total_value: float
    currency: str = "USD"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    deadline: Optional[str] = None
    milestones: List[Milestone] = []
    escrow_wallet: Optional[str] = None
    escrow_tx_init: Optional[str] = None
    total_released: float = 0.0
    audit_trail: List[AuditEntry] = []
    market_rate_flag: Optional[str] = None
    risk_flags: List[str] = []

    class Config:
        populate_by_name = True


# ─── Pending Approvals ────────────────────────────────────────────────────────

class PendingApproval(BaseModel):
    id: str = Field(default_factory=new_id, alias="_id")
    company_id: str
    agent_id: Optional[str] = None
    action_type: str
    tier: ActionTier
    payload: dict = {}
    status: ApprovalStatus = ApprovalStatus.pending
    requested_at: datetime = Field(default_factory=datetime.utcnow)
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    solana_tx: Optional[str] = None

    class Config:
        populate_by_name = True


# ─── Audit Log ───────────────────────────────────────────────────────────────

class AuditLog(BaseModel):
    id: str = Field(default_factory=new_id, alias="_id")
    company_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    action_type: str
    agent_id: Optional[str] = None
    agent_role: Optional[str] = None
    human_actor: Optional[str] = None
    payload: dict = {}
    tier: Optional[ActionTier] = None
    hitl_required: bool = False
    hitl_approved_by: Optional[str] = None
    hitl_approved_at: Optional[datetime] = None
    solana_tx: Optional[str] = None
    solana_memo: Optional[str] = None
    status: str = "completed"

    class Config:
        populate_by_name = True


# ─── Guardrail Log ───────────────────────────────────────────────────────────

class GuardrailSeverity(str, Enum):
    blocked = "blocked"
    goodhart = "goodhart"
    hitl_gate = "hitl_gate"
    approved = "approved"


class GuardrailLog(BaseModel):
    id: str = Field(default_factory=new_id, alias="_id")
    company_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    severity: GuardrailSeverity
    tier: Optional[ActionTier] = None
    agent_id: Optional[str] = None
    attempted_action: str
    reason: Optional[str] = None
    goodhart_violation: bool = False
    goodhart_reason: Optional[str] = None
    solana_tx: Optional[str] = None
    blocked: bool = False

    class Config:
        populate_by_name = True


# ─── Notification ─────────────────────────────────────────────────────────────

class NotificationType(str, Enum):
    action_required = "action_required"
    anomaly_detected = "anomaly_detected"
    milestone_submitted = "milestone_submitted"
    payment_released = "payment_released"
    renewal_upcoming = "renewal_upcoming"
    guardrail_triggered = "guardrail_triggered"
    contract_created = "contract_created"
    briefing_ready = "briefing_ready"


class Notification(BaseModel):
    id: str = Field(default_factory=new_id, alias="_id")
    company_id: str
    user_id: Optional[str] = None
    type: NotificationType
    title: str
    message: str
    read: bool = False
    action_url: Optional[str] = None
    metadata: Optional[dict] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
