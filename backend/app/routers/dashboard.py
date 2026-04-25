"""Dashboard router — financial pulse, metrics, anomalies, cash flow."""

from fastapi import APIRouter, Depends, Query
from datetime import datetime, timedelta
from typing import Optional
from app.config.mongodb import get_db
from app.middleware.auth import optional_auth
from app.services.gemma_service import analyze_anomaly

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

DEMO_COMPANY_ID = "demo-company-001"


def get_company_id(user: dict | None) -> str:
    if user:
        return user.get("https://cognitobiz.ai/company_id", DEMO_COMPANY_ID)
    return DEMO_COMPANY_ID


@router.get("/metrics")
async def get_metrics(user=Depends(optional_auth)):
    """Get key financial metrics for the dashboard."""
    company_id = get_company_id(user)
    db = get_db()

    # Get all transactions for this company
    thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
    sixty_days_ago = (datetime.utcnow() - timedelta(days=60)).strftime("%Y-%m-%d")
    today = datetime.utcnow().strftime("%Y-%m-%d")

    pipeline_current = [
        {"$match": {"company_id": company_id, "date": {"$gte": thirty_days_ago, "$lte": today}}},
        {"$group": {
            "_id": None,
            "total_in": {"$sum": {"$cond": [{"$gt": ["$amount", 0]}, "$amount", 0]}},
            "total_out": {"$sum": {"$cond": [{"$lt": ["$amount", 0]}, "$amount", 0]}},
            "count": {"$sum": 1},
        }},
    ]

    pipeline_prev = [
        {"$match": {"company_id": company_id, "date": {"$gte": sixty_days_ago, "$lt": thirty_days_ago}}},
        {"$group": {
            "_id": None,
            "total_in": {"$sum": {"$cond": [{"$gt": ["$amount", 0]}, "$amount", 0]}},
            "total_out": {"$sum": {"$cond": [{"$lt": ["$amount", 0]}, "$amount", 0]}},
        }},
    ]

    current = await db.transactions.aggregate(pipeline_current).to_list(1)
    prev = await db.transactions.aggregate(pipeline_prev).to_list(1)

    current_data = current[0] if current else {"total_in": 0, "total_out": 0, "count": 0}
    prev_data = prev[0] if prev else {"total_in": 0, "total_out": 0}

    burn_rate = abs(current_data.get("total_out", 0))
    revenue = current_data.get("total_in", 0)
    prev_revenue = prev_data.get("total_in", 0)

    # Get latest bank balance (most recent transaction running total)
    # In real app this comes from Plaid balance endpoint
    cash_position = await _get_cash_position(db, company_id)

    runway = (cash_position / burn_rate) if burn_rate > 0 else 999
    mom_growth = ((revenue - prev_revenue) / prev_revenue * 100) if prev_revenue > 0 else 0

    # Pending approvals count
    pending_count = await db.pending_approvals.count_documents(
        {"company_id": company_id, "status": "pending"}
    )

    return {
        "cash_position": cash_position,
        "burn_rate": burn_rate,
        "runway_months": round(runway, 1),
        "revenue_this_month": revenue,
        "mom_growth_pct": round(mom_growth, 1),
        "pending_approvals": pending_count,
        "last_updated": datetime.utcnow().isoformat(),
    }


@router.get("/expense-breakdown")
async def get_expense_breakdown(user=Depends(optional_auth)):
    """Get expense breakdown by category for current month."""
    company_id = get_company_id(user)
    db = get_db()

    thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
    today = datetime.utcnow().strftime("%Y-%m-%d")

    pipeline = [
        {"$match": {
            "company_id": company_id,
            "date": {"$gte": thirty_days_ago, "$lte": today},
            "amount": {"$lt": 0},
        }},
        {"$group": {
            "_id": "$category",
            "total": {"$sum": {"$abs": "$amount"}},
            "count": {"$sum": 1},
        }},
        {"$sort": {"total": -1}},
    ]

    categories = await db.transactions.aggregate(pipeline).to_list(20)

    return {
        "categories": [
            {
                "name": c["_id"] or "Miscellaneous",
                "amount": round(c["total"], 2),
                "count": c["count"],
            }
            for c in categories
        ],
        "period": "last_30_days",
    }


@router.get("/anomalies")
async def get_anomalies(user=Depends(optional_auth)):
    """Get flagged anomalous transactions."""
    company_id = get_company_id(user)
    db = get_db()

    anomalies = await db.transactions.find(
        {"company_id": company_id, "flagged": True, "status": {"$ne": "dismissed"}},
        sort=[("date", -1)],
        limit=20,
    ).to_list(20)

    return {
        "anomalies": [
            {
                "id": str(a["_id"]),
                "vendor": a.get("vendor", "Unknown"),
                "amount": abs(a.get("amount", 0)),
                "date": a.get("date"),
                "category": a.get("category"),
                "flag_reason": a.get("flag_reason"),
                "gemma_analysis": a.get("gemma_analysis"),
                "severity": _get_anomaly_severity(a),
            }
            for a in anomalies
        ]
    }


@router.post("/anomalies/{transaction_id}/dismiss")
async def dismiss_anomaly(transaction_id: str, user=Depends(optional_auth)):
    """Dismiss an anomaly card."""
    db = get_db()
    await db.transactions.update_one(
        {"_id": transaction_id},
        {"$set": {"status": "dismissed"}},
    )
    return {"success": True}


@router.get("/cashflow")
async def get_cashflow(
    days: int = Query(default=90, le=365),
    user=Depends(optional_auth),
):
    """Get daily cash flow data for the chart."""
    company_id = get_company_id(user)
    db = get_db()

    start_date = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
    today = datetime.utcnow().strftime("%Y-%m-%d")

    pipeline = [
        {"$match": {
            "company_id": company_id,
            "date": {"$gte": start_date, "$lte": today},
        }},
        {"$group": {
            "_id": "$date",
            "inflow": {"$sum": {"$cond": [{"$gt": ["$amount", 0]}, "$amount", 0]}},
            "outflow": {"$sum": {"$cond": [{"$lt": ["$amount", 0]}, {"$abs": "$amount"}, 0]}},
        }},
        {"$sort": {"_id": 1}},
    ]

    daily = await db.transactions.aggregate(pipeline).to_list(400)

    # Generate 30-day forward projection
    if daily:
        recent = daily[-30:] if len(daily) >= 30 else daily
        avg_in = sum(d["inflow"] for d in recent) / len(recent)
        avg_out = sum(d["outflow"] for d in recent) / len(recent)

        projections = []
        for i in range(1, 31):
            proj_date = (datetime.utcnow() + timedelta(days=i)).strftime("%Y-%m-%d")
            projections.append({
                "date": proj_date,
                "inflow": round(avg_in, 2),
                "outflow": round(avg_out, 2),
                "projected": True,
            })
    else:
        projections = []

    return {
        "historical": [
            {
                "date": d["_id"],
                "inflow": round(d["inflow"], 2),
                "outflow": round(d["outflow"], 2),
                "projected": False,
            }
            for d in daily
        ],
        "projections": projections,
    }


@router.get("/recurring-payments")
async def get_recurring_payments(user=Depends(optional_auth)):
    """Get detected recurring payments."""
    company_id = get_company_id(user)
    db = get_db()

    recurring = await db.transactions.find(
        {"company_id": company_id, "is_recurring": True},
        sort=[("amount", 1)],
    ).to_list(50)

    # Group by vendor
    seen = {}
    for t in recurring:
        vendor = t.get("vendor", "Unknown")
        if vendor not in seen:
            seen[vendor] = {
                "vendor": vendor,
                "amount": abs(t.get("amount", 0)),
                "frequency": "monthly",
                "category": t.get("category"),
                "last_charge": t.get("date"),
            }

    return {"recurring": list(seen.values())}


async def _get_cash_position(db, company_id: str) -> float:
    """Calculate current cash position from transaction history."""
    result = await db.transactions.aggregate([
        {"$match": {"company_id": company_id}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]).to_list(1)

    if result:
        return max(0, result[0].get("total", 0))

    # Default demo value
    return 185420.0


def _get_anomaly_severity(transaction: dict) -> str:
    amount = abs(transaction.get("amount", 0))
    if amount > 5000:
        return "high"
    elif amount > 1000:
        return "medium"
    return "low"