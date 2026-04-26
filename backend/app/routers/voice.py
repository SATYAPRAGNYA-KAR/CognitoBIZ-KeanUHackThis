"""Voice router for briefings, Q&A, and ElevenLabs testing.

Changes from original:
- VoiceQuestionRequest now accepts optional `language_code` (BCP-47)
- TTSTestRequest likewise accepts `language_code`
- /ask passes language_code through to elevenlabs_service
- /briefing passes language_code through
- /languages endpoint returns supported language list from the service
- Removed dangling commented-out import block
"""

from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.config.mongodb import get_db
from app.middleware.auth import optional_auth
from app.services import gemma_service
from app.services.elevenlabs_service import (
    ElevenLabsConfigurationError,
    elevenlabs_service,
)

router = APIRouter(prefix="/voice", tags=["voice"])

DEMO_COMPANY_ID = "demo-company-001"


def build_fallback_briefing(company_name: str) -> str:
    return (
        f"Good morning from {company_name}. Live financial data is temporarily unavailable, "
        "so this is a fallback briefing. Review pending approvals, confirm key renewals, "
        "and double-check runway assumptions before making new spending decisions today."
    )


def get_company_id(user) -> str:
    if user:
        return user.get("https://cognitobiz.ai/company_id", DEMO_COMPANY_ID)
    return DEMO_COMPANY_ID


class VoiceQuestionRequest(BaseModel):
    question: str
    conversation_history: List[dict] = Field(default_factory=list)
    language_code: Optional[str] = Field(
        default="en",
        description="BCP-47 language code for ElevenLabs TTS, e.g. 'en', 'es', 'fr'",
    )


class TTSTestRequest(BaseModel):
    text: str = "This is a CognitoBIZ ElevenLabs test."
    voice_id: Optional[str] = None
    language_code: Optional[str] = "en"


@router.get("/briefing")
async def get_morning_briefing(
    language_code: str = "en",
    user=Depends(optional_auth),
):
    company_id = get_company_id(user)
    company_name = "Your Company"
    script_error = None

    try:
        db = get_db()

        metrics_pipeline = [
            {"$match": {"company_id": company_id}},
            {
                "$group": {
                    "_id": None,
                    "total_in":  {"$sum": {"$cond": [{"$gt": ["$amount", 0]}, "$amount", 0]}},
                    "total_out": {"$sum": {"$cond": [{"$lt": ["$amount", 0]}, {"$abs": "$amount"}, 0]}},
                }
            },
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

        company = await db.companies.find_one({"_id": company_id}) or {"name": company_name}
        company_name = company.get("name", company_name)

        burn_rate = metrics.get("total_out", 0) / 30
        cash = 185420
        runway = (cash / burn_rate) if burn_rate > 0 else 999

        script = await gemma_service.generate_morning_briefing(
            metrics={
                "cash_position": cash,
                "burn_rate_monthly": metrics.get("total_out", 0),
                "revenue_monthly":  metrics.get("total_in", 0),
                "runway_months":    round(runway, 1),
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
            company_name=company_name,
        )
    except Exception as exc:
        script_error = str(exc)
        script = build_fallback_briefing(company_name)

    # ElevenLabs TTS — language_code controls which model is used
    audio_result = await elevenlabs_service.generate_briefing_audio(
        script, language_code=language_code
    )

    return {
        "script":            script,
        "audio_base64":      audio_result.get("audio_base64"),
        "mime_type":         "audio/mpeg",
        "duration_estimate": audio_result.get("duration_estimate_seconds"),
        "language_code":     language_code,
        "generated_at":      datetime.utcnow().isoformat(),
        "error":             audio_result.get("error") or script_error,
    }


@router.post("/ask")
async def voice_ask(req: VoiceQuestionRequest, user=Depends(optional_auth)):
    company_id = get_company_id(user)
    db = get_db()

    thirty_ago = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")

    spend_pipeline = [
        {"$match": {"company_id": company_id, "date": {"$gte": thirty_ago}, "amount": {"$lt": 0}}},
        {"$group": {"_id": "$category", "total": {"$sum": {"$abs": "$amount"}}}},
        {"$sort": {"total": -1}},
        {"$limit": 10},
    ]
    spend   = await db.transactions.aggregate(spend_pipeline).to_list(10)
    pending = await db.pending_approvals.count_documents({"company_id": company_id, "status": "pending"})

    financial_context = {
        "top_spend_categories": [{"category": s["_id"], "amount": round(s["total"], 2)} for s in spend],
        "pending_approvals": pending,
        "cash_position":     185420,
        "burn_rate":         24000,
        "runway_months":     7.7,
    }

    # Gemma generates the answer text
    answer_text = await gemma_service.answer_financial_question(
        question=req.question,
        financial_context=financial_context,
        conversation_history=req.conversation_history,
    )

    # ElevenLabs speaks it — honour the caller's chosen language
    audio_result = await elevenlabs_service.generate_briefing_audio(
        answer_text, language_code=req.language_code
    )

    return {
        "answer":        answer_text,
        "audio_base64":  audio_result.get("audio_base64"),
        "mime_type":     "audio/mpeg",
        "language_code": req.language_code,
        "error":         audio_result.get("error"),
    }


@router.get("/voices")
async def list_voices():
    try:
        voices = await elevenlabs_service.get_voices()
    except ElevenLabsConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "voices": [
            {
                "voice_id":    voice.get("voice_id"),
                "name":        voice.get("name"),
                "category":    voice.get("category"),
                "labels":      voice.get("labels", {}),
                "preview_url": voice.get("preview_url"),
            }
            for voice in voices
        ],
        "count":            len(voices),
        "default_voice_id": elevenlabs_service.voice_id,
    }


@router.get("/languages")
async def list_languages():
    """Return supported ElevenLabs TTS languages."""
    langs = elevenlabs_service.supported_languages()
    return {
        "languages": [
            {"code": code, "name": name}
            for code, name in sorted(langs.items(), key=lambda x: x[1])
        ],
        "default": "en",
    }


@router.post("/tts-test")
async def tts_test(req: TTSTestRequest):
    try:
        audio_result = await elevenlabs_service.generate_briefing_audio(
            req.text,
            voice_id=req.voice_id,
            language_code=req.language_code,
        )
    except ElevenLabsConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    if not audio_result.get("audio_base64"):
        raise HTTPException(status_code=502, detail=audio_result.get("error"))

    return audio_result