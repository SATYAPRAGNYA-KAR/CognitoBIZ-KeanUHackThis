"""Contracts router — WorkContract creation, milestone tracking, Solana escrow."""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
from app.config.mongodb import get_db
from app.middleware.auth import optional_auth
# from app.services import gemma_service, solana_service, guardrail_service
from app.services import gemma_service
from app.services.solana_service import solana_service
from app.services.guardrail_service import guardrail_service
from app.models.schemas import (
    Contract, Milestone, AuditEntry, MilestoneStatus,
    ContractStatus, Notification, NotificationType
)
import base64

router = APIRouter(prefix="/contracts", tags=["contracts"])

DEMO_COMPANY_ID = "demo-company-001"


def get_company_id(user) -> str:
    if user:
        return user.get("https://cognitobiz.ai/company_id", DEMO_COMPANY_ID)
    return DEMO_COMPANY_ID


class CreateContractRequest(BaseModel):
    description: str
    vendor_email: Optional[str] = None
    vendor_wallet: Optional[str] = None


class SubmitEvidenceRequest(BaseModel):
    evidence_links: List[str] = []
    notes: Optional[str] = None


@router.get("")
async def list_contracts(user=Depends(optional_auth)):
    """List all WorkContracts."""
    company_id = get_company_id(user)
    db = get_db()

    contracts = await db.contracts.find(
        {"company_id": company_id},
        sort=[("created_at", -1)],
    ).to_list(50)

    return {
        "contracts": [
            {
                "id": str(c["_id"]),
                "title": c.get("title"),
                "status": c.get("status"),
                "total_value": c.get("total_value"),
                "total_released": c.get("total_released", 0),
                "vendor_email": c.get("vendor_email"),
                "vendor_wallet": c.get("vendor_wallet"),
                "milestone_count": len(c.get("milestones", [])),
                "completed_milestones": sum(
                    1 for m in c.get("milestones", [])
                    if m.get("status") == "paid"
                ),
                "created_at": c.get("created_at"),
                "deadline": c.get("deadline"),
                "escrow_wallet": c.get("escrow_wallet"),
                "escrow_tx_init": c.get("escrow_tx_init"),
            }
            for c in contracts
        ]
    }


@router.post("")
async def create_contract(req: CreateContractRequest, user=Depends(optional_auth)):
    """Generate a WorkContract from natural language description using Gemma 4."""
    company_id = get_company_id(user)
    db = get_db()

    # Get company context
    company = await db.companies.find_one({"_id": company_id}) or {
        "industry": "SaaS", "stage": "seed", "name": "Demo Company"
    }

    # Gemma 4 generates the contract structure
    contract_data = await gemma_service.generate_work_contract(
        description=req.description,
        company_context={
            "industry": company.get("industry"),
            "stage": company.get("stage"),
            "name": company.get("name"),
        },
    )

    # Calculate deadline from timeline_days
    timeline_days = contract_data.get("timeline_days", 14)
    deadline = (datetime.utcnow() + timedelta(days=timeline_days)).strftime("%Y-%m-%d")

    # Build milestones
    milestones = []
    for m in contract_data.get("milestones", []):
        due_day = m.get("due_day", 7)
        due_date = (datetime.utcnow() + timedelta(days=due_day)).strftime("%Y-%m-%d")
        milestones.append(Milestone(
            id=m.get("id", 1),
            title=m.get("title"),
            description=m.get("description"),
            due_date=due_date,
            value=m.get("value", 0),
            evidence_required=m.get("evidence_required", []),
        ))

    # Create contract record
    contract = Contract(
        company_id=company_id,
        title=contract_data.get("title", "WorkContract"),
        vendor_email=req.vendor_email,
        vendor_wallet=req.vendor_wallet,
        status=ContractStatus.draft,
        total_value=contract_data.get("total_value", 0),
        deadline=deadline,
        milestones=milestones,
        market_rate_flag=contract_data.get("market_rate_flag"),
        risk_flags=contract_data.get("risk_flags", []),
    )

    doc = contract.model_dump(by_alias=True)
    await db.contracts.insert_one(doc)

    return {
        "contract_id": contract.id,
        "contract": contract_data,
        "milestones": [m.model_dump() for m in milestones],
        "market_rate_flag": contract_data.get("market_rate_flag"),
        "risk_flags": contract_data.get("risk_flags", []),
        "deadline": deadline,
    }


@router.post("/{contract_id}/activate")
async def activate_contract(contract_id: str, user=Depends(optional_auth)):
    """Activate a contract and initialize Solana escrow."""
    company_id = get_company_id(user)
    db = get_db()

    contract = await db.contracts.find_one({"_id": contract_id, "company_id": company_id})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    # HITL gate check — initializing escrow is Tier 3
    result = await guardrail_service.dispatch(
        action_type="initialize_escrow",
        payload={"contract_id": contract_id, "amount": contract["total_value"]},
        agent_id="contract_agent",
        company_id=company_id,
    )

    if not result["allowed"] and not result.get("requires_hitl"):
        raise HTTPException(status_code=403, detail=result["reason"])

    # Initialize Solana escrow
    escrow_result = await solana_service.initialize_escrow(
        contract_id=contract_id,
        amount_usd=contract["total_value"],
        company_id=company_id,
    )

    # Update contract
    await db.contracts.update_one(
        {"_id": contract_id},
        {
            "$set": {
                "status": "active",
                "escrow_wallet": escrow_result["escrow_wallet"],
                "escrow_tx_init": escrow_result["tx_hash"],
            },
            "$push": {
                "audit_trail": {
                    "event": "Contract Activated & Escrow Initialized",
                    "actor": user.get("sub", "owner") if user else "owner",
                    "timestamp": datetime.utcnow().isoformat(),
                    "solana_tx": escrow_result["tx_hash"],
                    "metadata": escrow_result,
                }
            },
        },
    )

    return {
        "success": True,
        "escrow": escrow_result,
        "contract_id": contract_id,
        "status": "active",
    }


@router.get("/{contract_id}")
async def get_contract(contract_id: str, user=Depends(optional_auth)):
    """Get full contract details."""
    db = get_db()
    contract = await db.contracts.find_one({"_id": contract_id})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    contract["id"] = str(contract.pop("_id", ""))
    return contract


@router.post("/{contract_id}/milestones/{milestone_id}/submit")
async def submit_milestone(
    contract_id: str,
    milestone_id: int,
    req: SubmitEvidenceRequest,
    user=Depends(optional_auth),
):
    """Vendor submits evidence for a milestone."""
    db = get_db()

    contract = await db.contracts.find_one({"_id": contract_id})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    # Find the milestone
    milestone = next(
        (m for m in contract.get("milestones", []) if m.get("id") == milestone_id), None
    )
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")

    # Build evidence list
    evidence = [{"type": "link", "url": link, "uploaded_at": datetime.utcnow().isoformat()}
                for link in req.evidence_links]

    # Gemma 4 verification
    gemma_review = await gemma_service.verify_milestone_evidence(milestone, evidence)

    # Update milestone in contract
    await db.contracts.update_one(
        {"_id": contract_id, "milestones.id": milestone_id},
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

    # Create notification for owner
    notification = Notification(
        company_id=contract.get("company_id"),
        type=NotificationType.milestone_submitted,
        title=f"Milestone {milestone_id} Submitted",
        message=f"Vendor submitted evidence for '{milestone.get('title')}'. Gemma review: {gemma_review.get('overall_status')}",
        action_url=f"/contracts/{contract_id}",
        metadata={"contract_id": contract_id, "milestone_id": milestone_id},
    )
    await db.notifications.insert_one(notification.model_dump(by_alias=True))

    return {
        "success": True,
        "gemma_review": gemma_review,
        "milestone_id": milestone_id,
        "status": "submitted",
    }


@router.post("/{contract_id}/milestones/{milestone_id}/approve")
async def approve_milestone(
    contract_id: str,
    milestone_id: int,
    user=Depends(optional_auth),
):
    """Owner approves a milestone and triggers Solana payment release."""
    company_id = get_company_id(user)
    db = get_db()

    contract = await db.contracts.find_one({"_id": contract_id})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    milestone = next(
        (m for m in contract.get("milestones", []) if m.get("id") == milestone_id), None
    )
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")

    # HITL gate for payment release
    result = await guardrail_service.dispatch(
        action_type="release_milestone",
        payload={
            "contract_id": contract_id,
            "milestone_id": milestone_id,
            "amount": milestone.get("value", 0),
            "vendor_email": contract.get("vendor_email"),
        },
        agent_id="payment_agent",
        company_id=company_id,
    )

    if result["requires_hitl"]:
        return {
            "success": True,
            "requires_approval": True,
            "approval_id": result["approval_id"],
            "message": "Payment approval request created. Awaiting confirmation.",
        }

    # Release Solana payment
    actor = user.get("sub", "owner") if user else "owner"
    vendor_wallet = contract.get("vendor_wallet") or "demo_vendor_wallet"

    tx_result = await solana_service.release_milestone_payment(
        contract_id=contract_id,
        milestone_id=milestone_id,
        amount_usd=milestone.get("value", 0),
        vendor_wallet=vendor_wallet,
        approved_by=actor,
    )

    # Update milestone and contract
    new_total_released = contract.get("total_released", 0) + milestone.get("value", 0)
    await db.contracts.update_one(
        {"_id": contract_id, "milestones.id": milestone_id},
        {
            "$set": {
                "milestones.$.status": "paid",
                "milestones.$.approved_by": actor,
                "milestones.$.approved_at": datetime.utcnow().isoformat(),
                "milestones.$.solana_tx": tx_result["tx_hash"],
                "total_released": new_total_released,
            },
            "$push": {
                "audit_trail": {
                    "event": f"Milestone {milestone_id} Approved & Payment Released",
                    "actor": actor,
                    "timestamp": datetime.utcnow().isoformat(),
                    "solana_tx": tx_result["tx_hash"],
                    "metadata": {"amount": milestone.get("value"), "milestone_id": milestone_id},
                }
            },
        },
    )

    # Check if all milestones complete
    updated_contract = await db.contracts.find_one({"_id": contract_id})
    all_paid = all(
        m.get("status") == "paid" for m in updated_contract.get("milestones", [])
    )
    if all_paid:
        await db.contracts.update_one(
            {"_id": contract_id}, {"$set": {"status": "completed"}}
        )

    return {
        "success": True,
        "tx_result": tx_result,
        "milestone_id": milestone_id,
        "amount_released": milestone.get("value"),
        "total_released": new_total_released,
        "contract_completed": all_paid,
        "explorer_url": solana_service.get_explorer_url(tx_result["tx_hash"]),
    }
