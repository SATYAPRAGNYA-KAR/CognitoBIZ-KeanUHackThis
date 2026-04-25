"""Voice router — Morning briefings and voice Q&A."""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from typing import List
from datetime import datetime, timedelta
from app.config.mongodb import get_db
from app.middleware.auth import optional_auth
from app.services import gemma_service
from app.services.elevenlabs_service import elevenlabs_service

router = APIRouter(prefix="/voice", tags=["voice"])

DEMO_COMPANY_ID = "demo-company-001"


def get_company_id(user) -> str:
    if user:
        return user.get("https://cognitobiz.ai/company_id", DEMO_COMPANY_ID)
    return DEMO_COMPANY_ID


class VoiceQuestionRequest(BaseModel):
    question: str
    conversation_history: List[dict] = []


@router.get("/briefing")
async def get_morning_briefing(user=Depends(optional_auth)):
    """Generate and return the morning briefing as audio + script."""
    company_id = get_company_id(user)
    db = get_db()

    # Gather context
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

    company = await db.companies.find_one({"_id": company_id}) or {"name": "Your Company"}

    burn_rate = metrics.get("total_out", 0) / 30
    cash = 185420  # Would come from Plaid in production
    runway = (cash / burn_rate) if burn_rate > 0 else 999

    # Generate script with Gemma
    script = await gemma_service.generate_morning_briefing(
        metrics={
            "cash_position": cash,
            "burn_rate_monthly": metrics.get("total_out", 0),
            "revenue_monthly": metrics.get("total_in", 0),
            "runway_months": round(runway, 1),
        },
        anomalies=[
            {
                "vendor": a.get("vendor"),
                "amount": abs(a.get("amount", 0)),
                "reason": a.get("flag_reason"),
            }
            for a in anomalies
        ],
        pending_approvals=pending_count,
        upcoming_renewals=[],
        company_name=company.get("name", "Your Company"),
    )

    # Generate audio with ElevenLabs
    audio_result = await elevenlabs_service.generate_briefing_audio(script)

    return {
        "script": script,
        "audio_base64": audio_result.get("audio_base64"),
        "mime_type": "audio/mpeg",
        "duration_estimate": audio_result.get("duration_estimate_seconds"),
        "generated_at": datetime.utcnow().isoformat(),
        "error": audio_result.get("error"),
    }


@router.post("/ask")
async def voice_ask(req: VoiceQuestionRequest, user=Depends(optional_auth)):
    """Answer a voice/text question about the company's financials."""
    company_id = get_company_id(user)
    db = get_db()

    # Build financial context
    thirty_ago = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")

    spend_pipeline = [
        {"$match": {"company_id": company_id, "date": {"$gte": thirty_ago}, "amount": {"$lt": 0}}},
        {"$group": {"_id": "$category", "total": {"$sum": {"$abs": "$amount"}}}},
        {"$sort": {"total": -1}},
        {"$limit": 10},
    ]
    spend = await db.transactions.aggregate(spend_pipeline).to_list(10)
    pending = await db.pending_approvals.count_documents({"company_id": company_id, "status": "pending"})

    financial_context = {
        "top_spend_categories": [{"category": s["_id"], "amount": round(s["total"], 2)} for s in spend],
        "pending_approvals": pending,
        "cash_position": 185420,
        "burn_rate": 24000,
        "runway_months": 7.7,
    }

    # Gemma generates text answer
    answer_text = await gemma_service.answer_financial_question(
        question=req.question,
        financial_context=financial_context,
        conversation_history=req.conversation_history,
    )

    # ElevenLabs converts to speech
    audio_result = await elevenlabs_service.generate_briefing_audio(answer_text)

    return {
        "answer": answer_text,
        "audio_base64": audio_result.get("audio_base64"),
        "mime_type": "audio/mpeg",
        "error": audio_result.get("error"),
    }