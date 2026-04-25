"""
Daily Morning Briefing Job — Scheduled task that generates and caches
the morning audio briefing using Gemma 4 + ElevenLabs.

Run standalone:  python -m app.jobs.briefing_job
Or schedule via APScheduler / cron at the company's configured briefing_time.
"""

import asyncio
from datetime import datetime, timedelta
from app.config.mongodb import connect_db, close_db, get_db
from app.services.gemma_service import generate_morning_briefing
from app.services.elevenlabs_service import elevenlabs_service
from app.models.schemas import Notification, NotificationType


async def generate_briefing_for_company(company_id: str) -> dict:
    """Generate and store a morning briefing for one company."""
    db = get_db()

    # Gather context
    company = await db.companies.find_one({"_id": company_id}) or {"name": "Your Company"}
    thirty_ago = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")

    metrics_pipeline = [
        {"$match": {"company_id": company_id}},
        {"$group": {
            "_id": None,
            "total_in": {"$sum": {"$cond": [{"$gt": ["$amount", 0]}, "$amount", 0]}},
            "total_out": {"$sum": {"$cond": [{"$lt": ["$amount", 0]}, {"$abs": "$amount"}, 0]}},
        }},
    ]
    metrics_data = await db.transactions.aggregate(metrics_pipeline).to_list(1)
    metrics = metrics_data[0] if metrics_data else {"total_in": 0, "total_out": 0}

    anomalies = await db.transactions.find(
        {"company_id": company_id, "flagged": True, "status": {"$ne": "dismissed"}},
        limit=3,
    ).to_list(3)

    pending_count = await db.pending_approvals.count_documents(
        {"company_id": company_id, "status": "pending"}
    )

    recurring = await db.transactions.find(
        {"company_id": company_id, "is_recurring": True},
        sort=[("date", -1)], limit=5,
    ).to_list(5)
    upcoming_renewals = [
        {"vendor": t.get("vendor"), "amount": abs(t.get("amount", 0))}
        for t in recurring
    ]

    burn = metrics.get("total_out", 0) / 30
    cash_position = 185420.0  # In production: fetch from Plaid balance
    runway = round(cash_position / burn, 1) if burn > 0 else 999.0

    # Generate script with Gemma
    script = await generate_morning_briefing(
        metrics={
            "cash_position": cash_position,
            "burn_rate_monthly": metrics.get("total_out", 0),
            "revenue_monthly": metrics.get("total_in", 0),
            "runway_months": runway,
        },
        anomalies=[
            {"vendor": a.get("vendor"), "amount": abs(a.get("amount", 0)), "reason": a.get("flag_reason")}
            for a in anomalies
        ],
        pending_approvals=pending_count,
        upcoming_renewals=upcoming_renewals,
        company_name=company.get("name", "Your Company"),
    )

    # Generate audio
    audio_result = await elevenlabs_service.generate_briefing_audio(script)

    # Store briefing record
    briefing_doc = {
        "company_id": company_id,
        "generated_at": datetime.utcnow().isoformat(),
        "script": script,
        "audio_base64": audio_result.get("audio_base64"),
        "mime_type": "audio/mpeg",
        "duration_estimate": audio_result.get("duration_estimate_seconds", 60),
        "error": audio_result.get("error"),
    }
    await db.briefings.replace_one(
        {"company_id": company_id},
        briefing_doc,
        upsert=True,
    )

    # Send notification
    notif = Notification(
        company_id=company_id,
        type=NotificationType.briefing_ready,
        title="Morning Briefing Ready",
        message=f"Your daily financial briefing is ready. Runway: {runway} months.",
        action_url="/dashboard",
    )
    await db.notifications.insert_one(notif.model_dump(by_alias=True))

    print(f"✅ Briefing generated for company {company_id} at {datetime.utcnow().isoformat()}")
    return briefing_doc


async def run_all_briefings():
    """Generate briefings for all companies whose configured briefing time has arrived."""
    await connect_db()
    db = get_db()

    current_hour = datetime.utcnow().strftime("%H:%M")
    # Find all companies with briefing_time matching current hour (within 5-min window)
    companies = await db.companies.find({}).to_list(500)
    generated = 0
    for company in companies:
        configured_time = company.get("settings", {}).get("briefing_time", "08:00")
        if configured_time[:5] == current_hour[:5]:
            await generate_briefing_for_company(str(company["_id"]))
            generated += 1

    await close_db()
    print(f"✅ Generated {generated} briefings at {current_hour}")


if __name__ == "__main__":
    asyncio.run(run_all_briefings())