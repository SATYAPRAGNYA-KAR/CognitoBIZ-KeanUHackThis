"""
Guardrail Service — Enforces constitutional AI constraints.
Every agent action passes through this service before execution.
Implements HITL gating and Goodhart's Law detection.
"""

from datetime import datetime
from typing import Optional
from app.models.schemas import (
    ActionTier, GuardrailSeverity, GuardrailLog, PendingApproval
)
from app.config.mongodb import get_db
from app.services.solana_service import solana_service


# Actions blocked regardless of context
BLOCKED_ACTIONS = {
    "delete_transactions",
    "purge_audit_log",
    "modify_permissions",
    "disable_guardrails",
    "self_modify",
    "delete_company",
}

# Action tier classification
ACTION_TIERS = {
    # Tier 1 - Autonomous
    "read_financials": ActionTier.tier1,
    "generate_analysis": ActionTier.tier1,
    "draft_report": ActionTier.tier1,
    "read_contracts": ActionTier.tier1,
    "benchmark_query": ActionTier.tier1,
    # Tier 2 - Soft approval
    "flag_transaction": ActionTier.tier2,
    "update_milestone_status": ActionTier.tier2,
    "send_notification": ActionTier.tier2,
    "generate_briefing": ActionTier.tier2,
    # Tier 3 - Hard approval (HITL required)
    "execute_payment": ActionTier.tier3,
    "release_milestone": ActionTier.tier3,
    "send_external_communication": ActionTier.tier3,
    "initialize_escrow": ActionTier.tier3,
    "approve_invoice": ActionTier.tier3,
    # Tier 4 - Always blocked
    "delete_transactions": ActionTier.tier4,
    "purge_audit_log": ActionTier.tier4,
    "modify_permissions": ActionTier.tier4,
    "disable_guardrails": ActionTier.tier4,
}


class GuardrailService:
    async def dispatch(
        self,
        action_type: str,
        payload: dict,
        agent_id: Optional[str],
        company_id: str,
        context: Optional[dict] = None,
    ) -> dict:
        """
        Central dispatcher for all agent actions.
        Returns {allowed: bool, tier: int, requires_hitl: bool, approval_id: str | None}
        """
        tier = ACTION_TIERS.get(action_type, ActionTier.tier2)

        # Tier 4 — Always block
        if tier == ActionTier.tier4 or action_type in BLOCKED_ACTIONS:
            await self._log_blocked(action_type, payload, agent_id, company_id)
            return {
                "allowed": False,
                "tier": 4,
                "requires_hitl": False,
                "reason": f"Action '{action_type}' is constitutionally blocked (Tier 4)",
                "approval_id": None,
            }

        # Tier 3 — Requires HITL approval
        if tier == ActionTier.tier3:
            approval_id = await self._create_pending_approval(
                action_type, payload, agent_id, company_id, tier
            )
            await self._log_hitl_gate(action_type, payload, agent_id, company_id, approval_id)
            return {
                "allowed": False,
                "tier": 3,
                "requires_hitl": True,
                "reason": "Action requires human approval (Tier 3)",
                "approval_id": approval_id,
            }

        # Tier 1 & 2 — Allow
        await self._log_approved(action_type, payload, agent_id, company_id, tier)
        return {
            "allowed": True,
            "tier": tier.value,
            "requires_hitl": False,
            "reason": "Action approved",
            "approval_id": None,
        }

    async def approve_pending(
        self,
        approval_id: str,
        approved_by: str,
        company_id: str,
    ) -> dict:
        """Human approves a pending HITL action. Executes the action post-approval."""
        db = get_db()

        approval = await db.pending_approvals.find_one({"_id": approval_id})
        if not approval:
            return {"success": False, "error": "Approval not found"}

        if approval.get("status") != "pending":
            return {"success": False, "error": f"Approval already {approval.get('status')}"}

        # Mark as approved
        await db.pending_approvals.update_one(
            {"_id": approval_id},
            {
                "$set": {
                    "status": "approved",
                    "approved_by": approved_by,
                    "approved_at": datetime.utcnow(),
                }
            },
        )

        # Write Solana audit memo
        tx_hash = await solana_service.write_audit_memo({
            "action_type": approval.get("action_type"),
            "actor": approved_by,
            "reference_id": approval_id,
        })

        # Log to guardrail log
        await self._write_guardrail_log(
            company_id=company_id,
            severity=GuardrailSeverity.approved,
            action=approval.get("action_type"),
            agent_id=approval.get("agent_id"),
            tier=ActionTier.tier3,
            reason=f"Approved by {approved_by}",
            blocked=False,
            solana_tx=tx_hash,
        )

        return {
            "success": True,
            "approval_id": approval_id,
            "action_type": approval.get("action_type"),
            "payload": approval.get("payload", {}),
            "solana_tx": tx_hash,
        }

    async def reject_pending(
        self, approval_id: str, rejected_by: str, company_id: str
    ) -> dict:
        """Human rejects a pending action."""
        db = get_db()
        await db.pending_approvals.update_one(
            {"_id": approval_id},
            {
                "$set": {
                    "status": "rejected",
                    "approved_by": rejected_by,
                    "approved_at": datetime.utcnow(),
                }
            },
        )
        return {"success": True, "approval_id": approval_id}

    async def _create_pending_approval(
        self,
        action_type: str,
        payload: dict,
        agent_id: Optional[str],
        company_id: str,
        tier: ActionTier,
    ) -> str:
        db = get_db()
        approval = PendingApproval(
            company_id=company_id,
            agent_id=agent_id,
            action_type=action_type,
            tier=tier,
            payload=payload,
        )
        doc = approval.model_dump(by_alias=True)
        await db.pending_approvals.insert_one(doc)
        return doc["_id"]

    async def _log_blocked(
        self, action: str, payload: dict, agent_id: Optional[str], company_id: str
    ):
        # Write Solana memo for blocked actions (immutable evidence)
        tx_hash = await solana_service.write_audit_memo({
            "action_type": f"BLOCKED:{action}",
            "actor": agent_id or "unknown",
            "reference_id": company_id,
        })
        await self._write_guardrail_log(
            company_id=company_id,
            severity=GuardrailSeverity.blocked,
            action=action,
            agent_id=agent_id,
            tier=ActionTier.tier4,
            reason=f"Constitutionally blocked: {action}",
            blocked=True,
            solana_tx=tx_hash,
        )

    async def _log_hitl_gate(
        self, action: str, payload: dict, agent_id: Optional[str], company_id: str, approval_id: str
    ):
        await self._write_guardrail_log(
            company_id=company_id,
            severity=GuardrailSeverity.hitl_gate,
            action=action,
            agent_id=agent_id,
            tier=ActionTier.tier3,
            reason=f"HITL gate — awaiting approval. ID: {approval_id}",
            blocked=False,
        )

    async def _log_approved(
        self, action: str, payload: dict, agent_id: Optional[str], company_id: str, tier: ActionTier
    ):
        await self._write_guardrail_log(
            company_id=company_id,
            severity=GuardrailSeverity.approved,
            action=action,
            agent_id=agent_id,
            tier=tier,
            reason=f"Tier {tier.value} action — autonomously approved",
            blocked=False,
        )

    async def _write_guardrail_log(
        self,
        company_id: str,
        severity: GuardrailSeverity,
        action: str,
        agent_id: Optional[str],
        tier: ActionTier,
        reason: str,
        blocked: bool,
        goodhart_violation: bool = False,
        goodhart_reason: Optional[str] = None,
        solana_tx: Optional[str] = None,
    ):
        db = get_db()
        log = GuardrailLog(
            company_id=company_id,
            severity=severity,
            tier=tier,
            agent_id=agent_id,
            attempted_action=action,
            reason=reason,
            goodhart_violation=goodhart_violation,
            goodhart_reason=goodhart_reason,
            solana_tx=solana_tx,
            blocked=blocked,
        )
        await db.guardrail_log.insert_one(log.model_dump(by_alias=True))

    async def check_and_flag_goodhart(
        self, recommendation: str, company_id: str, agent_id: Optional[str]
    ) -> dict:
        """Run Goodhart's Law check and log if violation detected."""
        from app.services.gemma_service import check_goodhart_violation

        result = await check_goodhart_violation(recommendation)

        if result.get("goodhart_violation"):
            await self._write_guardrail_log(
                company_id=company_id,
                severity=GuardrailSeverity.goodhart,
                action="recommendation_flagged",
                agent_id=agent_id,
                tier=ActionTier.tier2,
                reason="Goodhart's Law violation detected",
                blocked=True,
                goodhart_violation=True,
                goodhart_reason=result.get("reason"),
            )

        return result


# Singleton
guardrail_service = GuardrailService()