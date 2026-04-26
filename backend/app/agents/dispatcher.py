"""
Agent Dispatcher — Central router for all agent actions.
Every agent action must pass through dispatch_agent_action() before execution.
Enforces tier classification, HITL gating, and audit logging.
"""

from datetime import datetime
from typing import Optional
from app.models.schemas import ActionTier, AuditLog
from app.services.guardrail_service import guardrail_service
from app.config.mongodb import get_db


async def dispatch_agent_action(
    action_type: str,
    payload: dict,
    agent_id: str,
    agent_role: str,
    company_id: str,
    context: Optional[dict] = None,
) -> dict:
    """
    Central dispatcher for all agent-initiated actions.

    1. Passes action through the guardrail service (tier check + Goodhart check)
    2. Writes to the audit log regardless of outcome
    3. Returns a result dict with: allowed, tier, requires_hitl, approval_id

    Usage:
        result = await dispatch_agent_action(
            action_type="execute_payment",
            payload={"amount": 3000, "vendor": "dev@example.com"},
            agent_id="payment-agent-001",
            agent_role="payment_agent",
            company_id="company-xyz",
        )
        if not result["allowed"] and not result["requires_hitl"]:
            raise HTTPException(403, result["reason"])
    """
    # Guardrail check
    guard_result = await guardrail_service.dispatch(
        action_type=action_type,
        payload=payload,
        agent_id=agent_id,
        company_id=company_id,
        context=context,
    )

    # Write to audit log
    db = get_db()
    tier_val = guard_result.get("tier", 2)
    try:
        tier_enum = ActionTier(tier_val)
    except ValueError:
        tier_enum = ActionTier.tier2

    audit = AuditLog(
        company_id=company_id,
        action_type=action_type,
        agent_id=agent_id,
        agent_role=agent_role,
        payload=payload,
        tier=tier_enum,
        hitl_required=guard_result.get("requires_hitl", False),
        solana_tx=guard_result.get("solana_tx"),
        status="blocked" if not guard_result.get("allowed") and not guard_result.get("requires_hitl")
               else "pending" if guard_result.get("requires_hitl")
               else "completed",
    )
    await db.audit_log.insert_one(audit.model_dump(by_alias=True))

    return guard_result


async def dispatch_tier1_action(
    action_type: str,
    payload: dict,
    agent_id: str,
    agent_role: str,
    company_id: str,
) -> dict:
    """Shortcut for read-only / Tier 1 actions — logs but never blocks."""
    db = get_db()
    audit = AuditLog(
        company_id=company_id,
        action_type=action_type,
        agent_id=agent_id,
        agent_role=agent_role,
        payload=payload,
        tier=ActionTier.tier1,
        hitl_required=False,
        status="completed",
    )
    await db.audit_log.insert_one(audit.model_dump(by_alias=True))
    return {"allowed": True, "tier": 1, "requires_hitl": False, "reason": "Tier 1 autonomous action"}