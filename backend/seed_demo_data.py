"""
Seed script — inserts 90 days of realistic demo transactions for the
demo company into MongoDB Atlas, then seeds the company profile.

Run from the backend/ directory:
    python seed_demo_data.py
"""

import asyncio
import random
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from pathlib import Path
import os
import sys

# ── Load .env manually (same logic as settings.py) ──────────────────────────
env_path = Path(__file__).resolve().parent / "app" / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, val = line.partition("=")
            os.environ.setdefault(key.strip(), val.strip().strip('"'))

MONGO_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME   = os.environ.get("MONGODB_DB_NAME", "cognitobiz")

COMPANY_ID = "demo-company-001"

# ── Realistic monthly spend profile for a seed-stage SaaS (8 person team) ───
# These sit slightly above peer averages in Infrastructure and below in
# Marketing — intentional so the benchmark shows meaningful variance.
MONTHLY_SPEND = {
    "Infrastructure": {
        "vendors": ["AWS", "Vercel", "Cloudflare", "PlanetScale"],
        "amounts": [3800, 420, 120, 280],          # total ~$4,620/mo
        "is_recurring": True,
    },
    "Payroll": {
        "vendors": ["Gusto Payroll"],
        "amounts": [52000],                         # total ~$52,000/mo
        "is_recurring": True,
    },
    "Marketing": {
        "vendors": ["Google Ads", "LinkedIn Ads"],
        "amounts": [900, 400],                      # total ~$1,300/mo
        "is_recurring": False,
    },
    "Legal": {
        "vendors": ["Clerky", "Orrick LLP"],
        "amounts": [199, 250],                      # total ~$449/mo
        "is_recurring": True,
    },
    "Software Subscriptions": {
        "vendors": ["GitHub", "Figma", "Notion", "Slack", "Datadog", "Linear"],
        "amounts": [84, 180, 96, 125, 320, 96],    # total ~$901/mo
        "is_recurring": True,
    },
}

# Revenue — MRR growing ~8% MoM
BASE_MRR = 14200

# One-off expenses to add realism
ONE_OFF_EXPENSES = [
    {"vendor": "Legal Zoom", "category": "Legal", "amount": -1200, "day_offset": -75},
    {"vendor": "AWS re:Invent", "category": "Infrastructure", "amount": -2400, "day_offset": -60},
    {"vendor": "Stripe Atlas", "category": "Legal", "amount": -500, "day_offset": -50},
    {"vendor": "Google Ads (boost)", "category": "Marketing", "amount": -1800, "day_offset": -30},
    {"vendor": "HubSpot (annual)", "category": "Software Subscriptions", "amount": -3600, "day_offset": -20},
]


def date_str(days_ago: int) -> str:
    return (datetime.utcnow() - timedelta(days=days_ago)).strftime("%Y-%m-%d")


def build_transactions() -> list[dict]:
    txns = []
    today = datetime.utcnow()

    # 3 months of recurring spend
    for month_offset in range(3):          # 0 = this month, 1 = last, 2 = two ago
        base_day = 28 + month_offset * 30  # rough billing date per month
        mrr_multiplier = (1 - 0.08) ** month_offset

        for category, cfg in MONTHLY_SPEND.items():
            for vendor, amount in zip(cfg["vendors"], cfg["amounts"]):
                # Slight random variance ±8% to look real
                varied = round(amount * random.uniform(0.92, 1.08), 2)
                bill_day = base_day + random.randint(-2, 2)
                txns.append({
                    "_id": f"demo-{category[:3].lower()}-{vendor[:4].lower()}-{month_offset}-{random.randint(1000,9999)}",
                    "company_id": COMPANY_ID,
                    "amount": -varied,
                    "category": category,
                    "vendor": vendor,
                    "date": date_str(bill_day),
                    "source": "demo",
                    "status": "active",
                    "flagged": False,
                    "is_recurring": cfg["is_recurring"],
                    "created_at": datetime.utcnow().isoformat(),
                })

        # Revenue for this month
        mrr = round(BASE_MRR * mrr_multiplier * random.uniform(0.97, 1.03), 2)
        txns.append({
            "_id": f"demo-rev-stripe-{month_offset}-{random.randint(1000,9999)}",
            "company_id": COMPANY_ID,
            "amount": mrr,
            "category": "Revenue",
            "vendor": "Stripe",
            "date": date_str(base_day - 5),
            "source": "demo",
            "status": "active",
            "flagged": False,
            "is_recurring": True,
            "created_at": datetime.utcnow().isoformat(),
        })

    # One-off expenses
    for item in ONE_OFF_EXPENSES:
        txns.append({
            "_id": f"demo-oneoff-{item['vendor'][:6].lower().replace(' ', '')}-{random.randint(1000,9999)}",
            "company_id": COMPANY_ID,
            "amount": item["amount"],
            "category": item["category"],
            "vendor": item["vendor"],
            "date": date_str(abs(item["day_offset"])),
            "source": "demo",
            "status": "active",
            "flagged": False,
            "is_recurring": False,
            "created_at": datetime.utcnow().isoformat(),
        })

    return txns


COMPANY_PROFILE = {
    "_id": COMPANY_ID,
    "name": "CognitoBIZ Demo Co",
    "industry": "SaaS",
    "stage": "seed",
    "team_size": 8,
    "founded": "2023-06-01",
    "created_at": datetime.utcnow().isoformat(),
}


async def seed():
    print(f"Connecting to MongoDB at {MONGO_URI[:40]}...")
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]

    # Upsert company profile
    await db.companies.replace_one(
        {"_id": COMPANY_ID},
        COMPANY_PROFILE,
        upsert=True,
    )
    print("✅ Company profile upserted")

    # Clear existing demo transactions so re-running is idempotent
    deleted = await db.transactions.delete_many({"company_id": COMPANY_ID, "source": "demo"})
    print(f"🗑  Cleared {deleted.deleted_count} existing demo transactions")

    txns = build_transactions()
    await db.transactions.insert_many(txns, ordered=False)
    print(f"✅ Inserted {len(txns)} demo transactions")

    # Verify spend totals
    pipeline = [
        {"$match": {"company_id": COMPANY_ID, "amount": {"$lt": 0},
                    "date": {"$gte": date_str(30)}}},
        {"$group": {"_id": "$category", "total": {"$sum": {"$abs": "$amount"}}}},
        {"$sort": {"total": -1}},
    ]
    cats = await db.transactions.aggregate(pipeline).to_list(20)
    print("\nLast-30-day spend by category:")
    for c in cats:
        print(f"  {c['_id']:30s}  ${c['total']:>10,.2f}")

    client.close()
    print("\nDone. Re-run the benchmark — your company data will now appear.")


if __name__ == "__main__":
    asyncio.run(seed())