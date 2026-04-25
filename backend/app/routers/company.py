"""Notifications router and Company onboarding router."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.config.mongodb import get_db
from app.middleware.auth import optional_auth
from app.models.schemas import Notification, NotificationType, Company, CompanySettings

notifications_router = APIRouter(prefix="/notifications", tags=["notifications"])
company_router = APIRouter(prefix="/company", tags=["company"])

DEMO_COMPANY_ID = "demo-company-001"


def get_company_id(user) -> str:
    if user:
        return user.get("https://cognitobiz.ai/company_id", DEMO_COMPANY_ID)
    return DEMO_COMPANY_ID


# ─── Notifications ─────────────────────────────────────────────────────────────

@notifications_router.get("")
async def get_notifications(user=Depends(optional_auth)):
    """Get all notifications, sorted by newest first."""
    company_id = get_company_id(user)
    db = get_db()

    notifs = await db.notifications.find(
        {"company_id": company_id},
        sort=[("created_at", -1)],
        limit=50,
    ).to_list(50)

    return {
        "notifications": [
            {
                "id": str(n["_id"]),
                "type": n.get("type"),
                "title": n.get("title"),
                "message": n.get("message"),
                "read": n.get("read", False),
                "action_url": n.get("action_url"),
                "created_at": n.get("created_at"),
            }
            for n in notifs
        ],
        "unread_count": sum(1 for n in notifs if not n.get("read", False)),
    }


@notifications_router.post("/{notification_id}/read")
async def mark_read(notification_id: str, user=Depends(optional_auth)):
    db = get_db()
    await db.notifications.update_one(
        {"_id": notification_id}, {"$set": {"read": True}}
    )
    return {"success": True}


@notifications_router.post("/mark-all-read")
async def mark_all_read(user=Depends(optional_auth)):
    company_id = get_company_id(user)
    db = get_db()
    await db.notifications.update_many(
        {"company_id": company_id, "read": False},
        {"$set": {"read": True}},
    )
    return {"success": True}


# ─── Company ───────────────────────────────────────────────────────────────────

class CompanyCreateRequest(BaseModel):
    name: str
    industry: str
    stage: str
    team_size: int
    monthly_revenue_range: str
    currency: str = "USD"
    fiscal_year_start: int = 1


@company_router.post("")
async def create_company(req: CompanyCreateRequest, user=Depends(optional_auth)):
    db = get_db()
    owner_id = user.get("sub", "demo_owner") if user else "demo_owner"

    company = Company(
        **req.model_dump(),
        owner_user_id=owner_id,
    )
    await db.companies.insert_one(company.model_dump(by_alias=True))
    return {"company_id": company.id, "name": company.name}


@company_router.get("")
async def get_company(user=Depends(optional_auth)):
    company_id = get_company_id(user)
    db = get_db()

    company = await db.companies.find_one({"_id": company_id})
    if not company:
        return {
            "id": company_id,
            "name": "Acme Startup",
            "industry": "SaaS",
            "stage": "seed",
            "team_size": 8,
            "monthly_revenue_range": "25k-50k",
            "currency": "USD",
        }
    company["id"] = str(company.pop("_id", ""))
    return company


# ─── Demo Data Seed ───────────────────────────────────────────────────────────

@company_router.post("/seed-demo-data")
async def seed_demo_data(user=Depends(optional_auth)):
    """Seed 90 days of realistic startup transaction data for demo."""
    from datetime import timedelta
    import random

    db = get_db()
    company_id = get_company_id(user)

    # Clear existing demo data
    await db.transactions.delete_many({"company_id": company_id, "source": "demo"})

    transactions = []
    base_date = datetime.utcnow() - timedelta(days=90)

    # Recurring monthly expenses
    monthly_expenses = [
        {"vendor": "Amazon Web Services", "amount": -1200, "category": "Infrastructure", "subcategory": "Cloud"},
        {"vendor": "Stripe", "amount": -89, "category": "Software Subscriptions", "subcategory": "Payments"},
        {"vendor": "Figma", "amount": -40, "category": "Software Subscriptions", "subcategory": "Design"},
        {"vendor": "Slack", "amount": -80, "category": "Software Subscriptions", "subcategory": "Communication"},
        {"vendor": "GitHub", "amount": -21, "category": "Software Subscriptions", "subcategory": "DevTools"},
        {"vendor": "OpenAI", "amount": -340, "category": "Infrastructure", "subcategory": "AI APIs"},
        {"vendor": "Notion", "amount": -32, "category": "Software Subscriptions", "subcategory": "Productivity"},
        {"vendor": "Vercel", "amount": -20, "category": "Infrastructure", "subcategory": "Hosting"},
    ]

    for month_offset in range(3):
        month_start = base_date + timedelta(days=month_offset * 30)

        # Monthly payroll
        transactions.append({
            "company_id": company_id,
            "amount": -24000,
            "category": "Payroll",
            "vendor": "ADP Payroll",
            "date": (month_start + timedelta(days=1)).strftime("%Y-%m-%d"),
            "source": "demo",
            "flagged": False,
            "is_recurring": True,
        })

        # Monthly expenses
        for exp in monthly_expenses:
            date = month_start + timedelta(days=random.randint(1, 5))
            is_recurring = True
            amount = exp["amount"] * (1 + random.uniform(-0.05, 0.05))
            transactions.append({
                "company_id": company_id,
                "amount": round(amount, 2),
                "category": exp["category"],
                "subcategory": exp.get("subcategory"),
                "vendor": exp["vendor"],
                "date": date.strftime("%Y-%m-%d"),
                "source": "demo",
                "flagged": False,
                "is_recurring": is_recurring,
            })

        # Revenue (multiple customers)
        for day in range(1, 31, 3):
            rev_date = month_start + timedelta(days=day)
            if rev_date <= datetime.utcnow():
                transactions.append({
                    "company_id": company_id,
                    "amount": round(random.uniform(800, 4200), 2),
                    "category": "Revenue",
                    "vendor": f"Customer #{random.randint(100, 999)}",
                    "date": rev_date.strftime("%Y-%m-%d"),
                    "source": "demo",
                    "flagged": False,
                    "is_recurring": False,
                })

    # Anomaly: AWS spike
    transactions.append({
        "company_id": company_id,
        "amount": -3400,
        "category": "Infrastructure",
        "vendor": "Amazon Web Services",
        "date": (datetime.utcnow() - timedelta(days=5)).strftime("%Y-%m-%d"),
        "source": "demo",
        "flagged": True,
        "flag_reason": "AWS spend is $3,400 this month vs $1,200 average — 183% above baseline",
        "gemma_analysis": "Likely tied to increased traffic. If traffic has normalized, consider rightsizing EC2 instances. Estimated savings: $800-1,200/month.",
        "is_recurring": True,
    })

    # Anomaly: unexpected renewal
    transactions.append({
        "company_id": company_id,
        "amount": -480,
        "category": "Software Subscriptions",
        "vendor": "Figma",
        "date": (datetime.utcnow() - timedelta(days=2)).strftime("%Y-%m-%d"),
        "source": "demo",
        "flagged": True,
        "flag_reason": "Annual renewal auto-charged — $480. 3 team members have not logged in for 60+ days.",
        "gemma_analysis": "Consider downgrading to a smaller seat count. Potential savings: $144/year.",
        "is_recurring": True,
    })

    if transactions:
        await db.transactions.insert_many(transactions)

    # Seed company profile
    await db.companies.replace_one(
        {"_id": company_id},
        {
            "_id": company_id,
            "name": "Acme Startup",
            "industry": "SaaS",
            "stage": "seed",
            "team_size": 8,
            "monthly_revenue_range": "25k-50k",
            "currency": "USD",
            "fiscal_year_start": 1,
            "owner_user_id": "demo_owner",
            "created_at": datetime.utcnow().isoformat(),
            "settings": {
                "briefing_time": "08:00",
                "approval_threshold_usd": 500,
                "guardrails_enabled": True,
            },
        },
        upsert=True,
    )

    # Seed a sample notification
    await db.notifications.insert_many([
        {
            "_id": f"notif-001-{company_id}",
            "company_id": company_id,
            "type": "anomaly_detected",
            "title": "AWS Spend Spike Detected",
            "message": "AWS is 183% above your monthly average. Review recommended.",
            "read": False,
            "action_url": "/dashboard",
            "created_at": datetime.utcnow().isoformat(),
        },
        {
            "_id": f"notif-002-{company_id}",
            "company_id": company_id,
            "type": "renewal_upcoming",
            "title": "Figma Auto-Renewed",
            "message": "$480 charged. 3 users inactive for 60+ days.",
            "read": False,
            "action_url": "/dashboard",
            "created_at": datetime.utcnow().isoformat(),
        },
    ])

    return {
        "success": True,
        "transactions_seeded": len(transactions),
        "company_id": company_id,
    }