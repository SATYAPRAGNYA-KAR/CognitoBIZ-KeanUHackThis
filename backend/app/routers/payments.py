"""Payments router — unified invoice payment queue and recurring payment management."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from app.config.mongodb import get_db
from app.middleware.auth import optional_auth
from app.services.guardrail_service import guardrail_service
from app.services.solana_service import solana_service
from app.models.schemas import Notification, NotificationType, AuditLog, ActionTier

router = APIRouter(prefix="/payments", tags=["payments"])

DEMO_COMPANY_ID = "demo-company-001"


def get_company_id(user) -> str:
    if user:
        return user.get("https://cognitobiz.ai/company_id", DEMO_COMPANY_ID)
    return DEMO_COMPANY_ID


class ApproveInvoiceRequest(BaseModel):
    vendor_wallet: Optional[str] = None
    notes: Optional[str] = None


@router.get("")
async def get_payment_queue(user=Depends(optional_auth)):
    """Get unified payment queue: invoices + milestone approvals + recurring anomalies."""
    company_id = get_company_id(user)
    db = get_db()

    # 1. Pending invoices from document uploads
    invoice_docs = await db.documents.find(
        {"company_id": company_id, "status": {"$in": ["reviewed", "pending_payment"]}},
        sort=[("uploaded_at", -1)],
        limit=20,
    ).to_list(20)

    invoice_items = []
    for doc in invoice_docs:
        extracted = doc.get("extracted_data", {})
        if extracted.get("amount"):
            invoice_items.append({
                "id": str(doc["_id"]),
                "type": "invoice",
                "vendor": extracted.get("vendor", "Unknown"),
                "amount": extracted.get("amount", 0),
                "due_date": extracted.get("due_date"),
                "payment_terms": extracted.get("payment_terms"),
                "flags": extracted.get("flags", []),
                "gemma_note": doc.get("gemma_summary", ""),
                "gemma_confidence": "medium",
                "source": "document_upload",
                "filename": doc.get("filename"),
                "status": "pending",
            })

    # 2. Approved contract milestones awaiting payment
    contracts = await db.contracts.find(
        {"company_id": company_id, "status": "active"},
    ).to_list(50)

    milestone_items = []
    for contract in contracts:
        for m in contract.get("milestones", []):
            if m.get("status") == "submitted":
                gemma = m.get("gemma_review") or {}
                milestone_items.append({
                    "id": f"{contract['_id']}:m{m['id']}",
                    "type": "milestone",
                    "vendor": contract.get("vendor_email", "Vendor"),
                    "amount": m.get("value", 0),
                    "contract_id": str(contract["_id"]),
                    "contract_title": contract.get("title"),
                    "milestone_id": m.get("id"),
                    "milestone_title": m.get("title"),
                    "gemma_note": gemma.get("assessment", ""),
                    "gemma_confidence": gemma.get("confidence", "medium").lower(),
                    "overall_status": gemma.get("overall_status", "revision_needed"),
                    "source": "workcontract",
                    "status": "pending",
                })

    # 3. Flagged recurring anomalies
    flagged = await db.transactions.find(
        {"company_id": company_id, "flagged": True, "status": {"$ne": "dismissed"}, "amount": {"$lt": 0}},
        sort=[("date", -1)],
        limit=10,
    ).to_list(10)

    anomaly_items = []
    for t in flagged:
        anomaly_items.append({
            "id": str(t["_id"]),
            "type": "recurring_anomaly",
            "vendor": t.get("vendor", "Unknown"),
            "amount": abs(t.get("amount", 0)),
            "due_date": t.get("date"),
            "flag_reason": t.get("flag_reason"),
            "gemma_note": t.get("gemma_analysis", ""),
            "gemma_confidence": "high",
            "source": "anomaly_detection",
            "status": "flagged",
        })

    all_items = invoice_items + milestone_items + anomaly_items

    return {
        "queue": all_items,
        "total_count": len(all_items),
        "invoice_count": len(invoice_items),
        "milestone_count": len(milestone_items),
        "anomaly_count": len(anomaly_items),
        "total_pending_usd": round(sum(
            i["amount"] for i in all_items if i["status"] in ("pending", "flagged")
        ), 2),
    }


@router.post("/invoices/{document_id}/approve")
async def approve_invoice(
    document_id: str,
    req: ApproveInvoiceRequest,
    user=Depends(optional_auth),
):
    """Approve and pay an invoice via Solana."""
    company_id = get_company_id(user)
    db = get_db()

    doc = await db.documents.find_one({"_id": document_id, "company_id": company_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    extracted = doc.get("extracted_data", {})
    amount = extracted.get("amount", 0)
    vendor = extracted.get("vendor", "Unknown Vendor")

    result = await guardrail_service.dispatch(
        action_type="approve_invoice",
        payload={"document_id": document_id, "amount": amount, "vendor": vendor},
        agent_id="payment_agent",
        company_id=company_id,
    )

    if result.get("requires_hitl"):
        return {
            "success": True,
            "requires_approval": True,
            "approval_id": result["approval_id"],
            "message": "Invoice payment queued for approval.",
        }

    actor = user.get("sub", "owner") if user else "owner"
    vendor_wallet = req.vendor_wallet or "demo_vendor_wallet"

    tx = await solana_service.release_milestone_payment(
        contract_id=f"invoice:{document_id}",
        milestone_id=0,
        amount_usd=amount,
        vendor_wallet=vendor_wallet,
        approved_by=actor,
    )

    await db.documents.update_one(
        {"_id": document_id},
        {"$set": {"status": "paid", "action_taken": "approved_and_paid"}},
    )

    log = AuditLog(
        company_id=company_id,
        action_type="invoice_payment_executed",
        human_actor=actor,
        payload={"document_id": document_id, "amount": amount, "vendor": vendor},
        tier=ActionTier.tier3,
        hitl_required=True,
        hitl_approved_by=actor,
        hitl_approved_at=datetime.utcnow(),
        solana_tx=tx["tx_hash"],
    )
    await db.audit_log.insert_one(log.model_dump(by_alias=True))

    notif = Notification(
        company_id=company_id,
        type=NotificationType.payment_released,
        title=f"Invoice Paid — {vendor}",
        message=f"${amount:,.0f} paid to {vendor}. Tx: {tx['tx_hash'][:12]}...",
        action_url="/audit",
    )
    await db.notifications.insert_one(notif.model_dump(by_alias=True))

    return {
        "success": True,
        "tx_result": tx,
        "amount": amount,
        "vendor": vendor,
        "explorer_url": solana_service.get_explorer_url(tx["tx_hash"]),
    }


@router.post("/transactions/{transaction_id}/dismiss")
async def dismiss_flagged_transaction(transaction_id: str, user=Depends(optional_auth)):
    """Dismiss a flagged transaction from the queue."""
    db = get_db()
    await db.transactions.update_one(
        {"_id": transaction_id},
        {"$set": {"status": "dismissed"}},
    )
    return {"success": True}


@router.get("/recurring")
async def get_recurring_payments(user=Depends(optional_auth)):
    """Get all detected recurring payments with Gemma optimization note."""
    from app.services.gemma_service import generate_recurring_optimization
    from app.routers.dashboard import _get_cash_position

    company_id = get_company_id(user)
    db = get_db()

    recurring = await db.transactions.find(
        {"company_id": company_id, "is_recurring": True},
        sort=[("amount", 1)],
    ).to_list(100)

    seen: dict = {}
    for t in recurring:
        vendor = t.get("vendor", "Unknown")
        if vendor not in seen or t.get("date", "") > seen[vendor].get("date", ""):
            seen[vendor] = t

    recurring_list = [
        {
            "vendor": v,
            "amount": abs(t.get("amount", 0)),
            "category": t.get("category"),
            "last_charge": t.get("date"),
            "flagged": t.get("flagged", False),
            "flag_reason": t.get("flag_reason"),
            "frequency": "monthly",
        }
        for v, t in seen.items()
    ]

    thirty_ago = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
    burn_data = await db.transactions.aggregate([
        {"$match": {"company_id": company_id, "date": {"$gte": thirty_ago}, "amount": {"$lt": 0}}},
        {"$group": {"_id": None, "total": {"$sum": {"$abs": "$amount"}}}},
    ]).to_list(1)
    burn = burn_data[0]["total"] if burn_data else 24000
    cash = await _get_cash_position(db, company_id)
    runway = round(cash / burn, 1) if burn > 0 else 999

    optimization = ""
    if recurring_list:
        try:
            optimization = await generate_recurring_optimization(recurring_list, runway)
        except Exception:
            optimization = "Optimization analysis unavailable."

    return {
        "recurring": recurring_list,
        "total_monthly_recurring": round(sum(r["amount"] for r in recurring_list), 2),
        "flagged_count": sum(1 for r in recurring_list if r["flagged"]),
        "optimization_note": optimization,
    }