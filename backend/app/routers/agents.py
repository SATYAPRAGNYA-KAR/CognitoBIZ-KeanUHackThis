"""Agents router — AI agent roster and identity management."""

from fastapi import APIRouter, Depends
from app.config.mongodb import get_db
from app.middleware.auth import optional_auth

router = APIRouter(prefix="/agents", tags=["agents"])

DEMO_AGENTS = [
    {
        "id": "cfo-agent-001",
        "name": "CFO Agent",
        "role": "cfo_agent",
        "status": "active",
        "scopes": ["read:financials", "read:snowflake", "draft:reports", "request:payment"],
        "blocked_scopes": ["execute:payment", "delete:any"],
        "last_active": "2025-04-25T09:30:00Z",
        "actions_today": 12,
        "description": "Financial analysis, benchmarking, simulation & daily briefings",
    },
    {
        "id": "contract-agent-001",
        "name": "Contract Agent",
        "role": "contract_agent",
        "status": "active",
        "scopes": ["read:contracts", "write:milestones", "request:payment"],
        "blocked_scopes": ["execute:payment", "modify:permissions"],
        "last_active": "2025-04-25T08:15:00Z",
        "actions_today": 5,
        "description": "WorkContract generation, milestone verification & vendor management",
    },
    {
        "id": "payment-agent-001",
        "name": "Payment Agent",
        "role": "payment_agent",
        "status": "active",
        "scopes": ["read:pending_payments"],
        "blocked_scopes": ["execute:payment", "self_approve"],
        "last_active": "2025-04-25T10:00:00Z",
        "actions_today": 3,
        "description": "Payment requests only — can never self-approve. Human required.",
    },
    {
        "id": "audit-agent-001",
        "name": "Audit Agent",
        "role": "audit_agent",
        "status": "active",
        "scopes": ["read:all", "generate:reports"],
        "blocked_scopes": ["write:any", "delete:any", "execute:any"],
        "last_active": "2025-04-25T06:00:00Z",
        "actions_today": 2,
        "description": "Read-only audit trail generation. Cannot modify any data.",
    },
]


@router.get("")
async def list_agents(user=Depends(optional_auth)):
    """Get all AI agents and their permission sets."""
    return {"agents": DEMO_AGENTS}