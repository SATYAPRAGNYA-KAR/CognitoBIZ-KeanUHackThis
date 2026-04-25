"""Vendor router — scoped vendor portal for WorkContract access only."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.config.mongodb import get_db
from app.middleware.auth import optional_auth
from app.services import gemma_service
from app.models.schemas import Notification, NotificationType

router = APIRouter(prefix="/vendor", tags=["vendor"])


def _check_vendor_access(user: dict | None, contract_id: str) -> bool:
    """Verify vendor JWT claim matches the requested contract."""
    if user is None:
        return True  # demo mode: allow access
    user_role = user.get("https://cognitobiz.ai/role", "")
    if user_role != "vendor":
        return True  # owners/admins can also access
    vendor_contract_id = user.get("https://cognitobiz.ai/contract_id", "")
    return vendor_contract_id == contract_id


class SubmitEvidenceRequest(BaseModel):
    milestone_id: int
    evidence_links: List[str] = []
    notes: Optional[str] = None


@router.get("/contract/{contract_id}")
async def get_vendor_contract(contract_id: str, user=Depends(optional_auth)):
    """Get contract details — scoped to vendor's contract only."""
    if not _check_vendor_access(user, contract_id):
        raise HTTPException(status_code=403, detail="Access denied: contract scope mismatch")

    db = get_db()
    contract = await db.contracts.find_one({"_id": contract_id})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    # Build vendor-safe view (exclude internal company data)
    milestones = []
    for m in contract.get("milestones", []):
        milestones.append({
            "id": m.get("id"),
            "title": m.get("title"),
            "description": m.get("description"),
            "due_date": m.get("due_date"),
            "value": m.get("value"),
            "status": m.get("status"),
            "evidence_required": m.get("evidence_required", []),
            "evidence_submitted": m.get("evidence_submitted", []),
            "approved_at": m.get("approved_at"),
            "solana_tx": m.get("solana_tx"),
            # Include Gemma review summary only (not raw scores)
            "gemma_summary": m.get("gemma_review", {}).get("assessment") if m.get("gemma_review") else None,
        })

    return {
        "id": str(contract["_id"]),
        "title": contract.get("title"),
        "status": contract.get("status"),
        "total_value": contract.get("total_value"),
        "currency": contract.get("currency", "USD"),
        "deadline": contract.get("deadline"),
        "milestones": milestones,
        "total_released": contract.get("total_released", 0),
        "escrow_wallet": contract.get("escrow_wallet"),
        "escrow_tx_init": contract.get("escrow_tx_init"),
        # Escrow proof: shows vendor the funds are locked
        "escrow_confirmed": bool(contract.get("escrow_tx_init")),
        "payment_history": [
            {
                "milestone_id": m.get("id"),
                "title": m.get("title"),
                "amount": m.get("value"),
                "paid_at": m.get("approved_at"),
                "solana_tx": m.get("solana_tx"),
            }
            for m in contract.get("milestones", [])
            if m.get("status") == "paid"
        ],
    }


@router.post("/contract/{contract_id}/submit")
async def submit_milestone_evidence(
    contract_id: str,
    req: SubmitEvidenceRequest,
    user=Depends(optional_auth),
):
    """Vendor submits evidence for a milestone."""
    if not _check_vendor_access(user, contract_id):
        raise HTTPException(status_code=403, detail="Access denied: contract scope mismatch")

    db = get_db()
    contract = await db.contracts.find_one({"_id": contract_id})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    milestone = next(
        (m for m in contract.get("milestones", []) if m.get("id") == req.milestone_id), None
    )
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")

    if milestone.get("status") not in ("pending", "revision_requested"):
        raise HTTPException(
            status_code=400,
            detail=f"Milestone cannot be submitted in status: {milestone.get('status')}"
        )

    evidence = [
        {"type": "link", "url": link, "uploaded_at": datetime.utcnow().isoformat()}
        for link in req.evidence_links
    ]
    if req.notes:
        evidence.append({"type": "note", "url": None, "text": req.notes, "uploaded_at": datetime.utcnow().isoformat()})

    # Gemma verification
    gemma_review = await gemma_service.verify_milestone_evidence(milestone, evidence)

    await db.contracts.update_one(
        {"_id": contract_id, "milestones.id": req.milestone_id},
        {
            "$set": {
                "milestones.$.status": "submitted",
                "milestones.$.evidence_submitted": evidence,
                "milestones.$.gemma_review": {
                    **gemma_review,
                    "reviewed_at": datetime.utcnow().isoformat(),
                },
            }
        },
    )

    # Notify the owner
    notif = Notification(
        company_id=contract.get("company_id", ""),
        type=NotificationType.milestone_submitted,
        title=f"Milestone {req.milestone_id} Submitted",
        message=f"Evidence submitted for '{milestone.get('title')}'. Gemma: {gemma_review.get('overall_status', 'pending review')}",
        action_url=f"/contracts/{contract_id}",
        metadata={"contract_id": contract_id, "milestone_id": req.milestone_id},
    )
    await db.notifications.insert_one(notif.model_dump(by_alias=True))

    return {
        "success": True,
        "milestone_id": req.milestone_id,
        "status": "submitted",
        "gemma_review": {
            "overall_status": gemma_review.get("overall_status"),
            "recommendation": gemma_review.get("recommendation"),
            "confidence": gemma_review.get("confidence"),
        },
        "message": "Evidence submitted. The owner will review Gemma's assessment and approve or request revisions.",
    }