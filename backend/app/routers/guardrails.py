"""Guardrails router — constitutional AI enforcement feed."""

from fastapi import APIRouter, Depends
from app.config.mongodb import get_db
from app.middleware.auth import optional_auth
from app.services.guardrail_service import guardrail_service

router = APIRouter(prefix="/guardrails", tags=["guardrails"])

DEMO_COMPANY_ID = "demo-company-001"


def get_company_id(user) -> str:
    if user:
        return user.get("https://cognitobiz.ai/company_id", DEMO_COMPANY_ID)
    return DEMO_COMPANY_ID


@router.get("")
async def get_guardrail_feed(user=Depends(optional_auth)):
    """Get guardrail activity log."""
    company_id = get_company_id(user)
    db = get_db()

    logs = await db.guardrail_log.find(
        {"company_id": company_id},
        sort=[("timestamp", -1)],
        limit=50,
    ).to_list(50)

    return {
        "logs": [
            {
                "id": str(l["_id"]),
                "timestamp": l.get("timestamp"),
                "severity": l.get("severity"),
                "tier": l.get("tier"),
                "attempted_action": l.get("attempted_action"),
                "reason": l.get("reason"),
                "blocked": l.get("blocked", False),
                "goodhart_violation": l.get("goodhart_violation", False),
                "goodhart_reason": l.get("goodhart_reason"),
                "solana_tx": l.get("solana_tx"),
                "agent_id": l.get("agent_id"),
            }
            for l in logs
        ]
    }


@router.get("/pending-approvals")
async def get_pending_approvals(user=Depends(optional_auth)):
    """Get all pending HITL approvals."""
    company_id = get_company_id(user)
    db = get_db()

    approvals = await db.pending_approvals.find(
        {"company_id": company_id, "status": "pending"},
        sort=[("requested_at", -1)],
    ).to_list(50)

    return {
        "approvals": [
            {
                "id": str(a["_id"]),
                "action_type": a.get("action_type"),
                "tier": a.get("tier"),
                "payload": a.get("payload", {}),
                "requested_at": a.get("requested_at"),
                "status": a.get("status"),
            }
            for a in approvals
        ]
    }


@router.post("/pending-approvals/{approval_id}/approve")
async def approve_action(approval_id: str, user=Depends(optional_auth)):
    """Human approves a pending action."""
    company_id = get_company_id(user)
    actor = user.get("sub", "owner") if user else "owner"

    result = await guardrail_service.approve_pending(
        approval_id=approval_id,
        approved_by=actor,
        company_id=company_id,
    )
    return result


@router.post("/pending-approvals/{approval_id}/reject")
async def reject_action(approval_id: str, user=Depends(optional_auth)):
    """Human rejects a pending action."""
    company_id = get_company_id(user)
    actor = user.get("sub", "owner") if user else "owner"

    result = await guardrail_service.reject_pending(
        approval_id=approval_id,
        rejected_by=actor,
        company_id=company_id,
    )
    return result