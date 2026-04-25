"""Audit router — complete action timeline with Solana proof links."""

from fastapi import APIRouter, Depends, Query
from app.config.mongodb import get_db
from app.middleware.auth import optional_auth
from app.services.solana_service import solana_service

router = APIRouter(prefix="/audit", tags=["audit"])

DEMO_COMPANY_ID = "demo-company-001"


def get_company_id(user) -> str:
    if user:
        return user.get("https://cognitobiz.ai/company_id", DEMO_COMPANY_ID)
    return DEMO_COMPANY_ID


@router.get("")
async def get_audit_log(
    limit: int = Query(default=50, le=200),
    action_type: str = Query(default=None),
    user=Depends(optional_auth),
):
    """Get full audit timeline."""
    company_id = get_company_id(user)
    db = get_db()

    query = {"company_id": company_id}
    if action_type:
        query["action_type"] = action_type

    logs = await db.audit_log.find(
        query, sort=[("timestamp", -1)], limit=limit
    ).to_list(limit)

    return {
        "logs": [
            {
                "id": str(l["_id"]),
                "timestamp": l.get("timestamp"),
                "action_type": l.get("action_type"),
                "agent_role": l.get("agent_role"),
                "human_actor": l.get("human_actor"),
                "tier": l.get("tier"),
                "hitl_required": l.get("hitl_required", False),
                "hitl_approved_by": l.get("hitl_approved_by"),
                "solana_tx": l.get("solana_tx"),
                "explorer_url": solana_service.get_explorer_url(l["solana_tx"]) if l.get("solana_tx") else None,
                "status": l.get("status"),
                "payload": l.get("payload", {}),
            }
            for l in logs
        ]
    }


@router.get("/contracts/{contract_id}")
async def get_contract_audit(contract_id: str, user=Depends(optional_auth)):
    """Get the complete audit chain for a WorkContract."""
    db = get_db()

    contract = await db.contracts.find_one({"_id": contract_id})
    if not contract:
        return {"trail": []}

    trail = contract.get("audit_trail", [])
    for entry in trail:
        if entry.get("solana_tx"):
            entry["explorer_url"] = solana_service.get_explorer_url(entry["solana_tx"])

    return {
        "contract_id": contract_id,
        "title": contract.get("title"),
        "total_value": contract.get("total_value"),
        "status": contract.get("status"),
        "trail": trail,
        "milestones": [
            {
                "id": m.get("id"),
                "title": m.get("title"),
                "status": m.get("status"),
                "value": m.get("value"),
                "approved_at": m.get("approved_at"),
                "solana_tx": m.get("solana_tx"),
                "explorer_url": solana_service.get_explorer_url(m["solana_tx"]) if m.get("solana_tx") else None,
            }
            for m in contract.get("milestones", [])
        ],
    }