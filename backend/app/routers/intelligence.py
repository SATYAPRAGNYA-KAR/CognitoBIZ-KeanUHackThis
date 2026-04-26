"""Intelligence router — peer benchmarking, runway simulator, document analysis."""

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from typing import Optional
import base64
from app.config.mongodb import get_db
from app.middleware.auth import optional_auth
from app.services import gemma_service
from app.services.guardrail_service import guardrail_service
from app.services.snowflake_service import snowflake_service
from app.models.schemas import Document
from datetime import datetime

router = APIRouter(prefix="/intelligence", tags=["intelligence"])

DEMO_COMPANY_ID = "demo-company-001"


def get_company_id(user) -> str:
    if user:
        return user.get("https://cognitobiz.ai/company_id", DEMO_COMPANY_ID)
    return DEMO_COMPANY_ID


class RunwayScenario(BaseModel):
    new_hires: int = 0
    hire_salary_annual: float = 120000
    revenue_growth_change_pct: float = 0
    one_time_expense: float = 0
    cost_cut_pct: float = 0
    current_cash: float = 0
    current_burn: float = 0
    current_revenue: float = 0


@router.get("/benchmark")
async def get_benchmark(user=Depends(optional_auth)):
    """Generate peer benchmarking analysis using Snowflake + Gemma 4."""
    company_id = get_company_id(user)

    # Default company profile — used if DB is unavailable
    company = {
        "_id": company_id,
        "industry": "SaaS",
        "stage": "seed",
        "name": "Your Company",
        "team_size": 8,
    }
    company_spend: dict = {}

    # Try to get live data from DB — gracefully skip if unavailable
    try:
        db = get_db()
        db_company = await db.companies.find_one({"_id": company_id})
        if db_company:
            company = db_company

        from datetime import timedelta
        thirty_ago = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
        pipeline = [
            {"$match": {"company_id": company_id, "date": {"$gte": thirty_ago}, "amount": {"$lt": 0}}},
            {"$group": {"_id": "$category", "total": {"$sum": {"$abs": "$amount"}}}},
        ]
        spend_docs = await db.transactions.aggregate(pipeline).to_list(20)
        company_spend = {d["_id"]: d["total"] for d in spend_docs if d["_id"]}
    except Exception as db_err:
        print(f"DB unavailable for benchmark, using defaults: {db_err}")

    # Get peer benchmarks from Snowflake (has its own mock fallback)
    peer_data = await snowflake_service.get_peer_benchmarks(
        industry=company.get("industry", "SaaS"),
        stage=company.get("stage", "seed"),
    )

    company_context = {
        "name": company.get("name", "Your Company"),
        "industry": company.get("industry", "SaaS"),
        "stage": company.get("stage", "seed"),
        "team_size": company.get("team_size", 8),
    }

    # Gemma 4 analysis — has its own fallback on failure
    try:
        analysis = await gemma_service.generate_benchmarking_analysis(
            company_metrics=company_spend,
            peer_data=peer_data,
            company_context=company_context,
        )
    except Exception as gemma_err:
        # Build a minimal fallback so the frontend chart still renders
        raise HTTPException(
            status_code=503,
            detail=f"Gemma API error: {gemma_err}. Check GOOGLE_AI_API_KEY in backend/app/.env",
        )

    # Goodhart check — best-effort, never block the response
    try:
        if analysis.get("top_recommendations"):
            for rec in analysis["top_recommendations"][:2]:
                await guardrail_service.check_and_flag_goodhart(rec, company_id, "cfo_agent")
    except Exception:
        pass

    return {
        "company_name": company.get("name", "Your Company"),
        "industry": company.get("industry", "SaaS"),
        "stage": company.get("stage", "seed"),
        "analysis": analysis,
        "data_source": "snowflake_marketplace",
    }


@router.post("/runway-simulate")
async def simulate_runway(scenario: RunwayScenario, user=Depends(optional_auth)):
    """Simulate runway under different financial scenarios."""
    company_id = get_company_id(user)

    # If no current data passed, fetch from DB
    if scenario.current_cash == 0:
        db = get_db()
        from app.routers.dashboard import _get_cash_position
        scenario.current_cash = await _get_cash_position(db, company_id)

    # Calculate adjusted burn rate
    hire_cost_monthly = (scenario.new_hires * scenario.hire_salary_annual) / 12
    cut_savings = scenario.current_burn * (scenario.cost_cut_pct / 100)
    adjusted_burn = scenario.current_burn + hire_cost_monthly - cut_savings + (
        scenario.one_time_expense / 12  # amortize over year
    )
    adjusted_revenue = scenario.current_revenue * (
        1 + scenario.revenue_growth_change_pct / 100
    )
    adjusted_net_burn = max(0, adjusted_burn - adjusted_revenue)
    current_net_burn = max(0, scenario.current_burn - scenario.current_revenue)

    current_runway = (scenario.current_cash / current_net_burn) if current_net_burn > 0 else 999
    simulated_runway = (scenario.current_cash / adjusted_net_burn) if adjusted_net_burn > 0 else 999

    # Gemma narrative
    metrics = {
        "current_cash": scenario.current_cash,
        "current_burn": scenario.current_burn,
        "current_revenue": scenario.current_revenue,
        "current_runway_months": round(current_runway, 1),
    }
    simulation_context = {
        "new_hires": scenario.new_hires,
        "hire_salary_annual": scenario.hire_salary_annual,
        "revenue_growth_change_pct": scenario.revenue_growth_change_pct,
        "one_time_expense": scenario.one_time_expense,
        "cost_cut_pct": scenario.cost_cut_pct,
        "adjusted_burn": round(adjusted_burn, 2),
        "adjusted_runway": round(simulated_runway, 1),
    }
    gemma_result = await gemma_service.generate_runway_simulation(metrics, simulation_context)

    return {
        "current_runway_months": round(current_runway, 1),
        "simulated_runway_months": round(simulated_runway, 1),
        "delta_months": round(simulated_runway - current_runway, 1),
        "adjusted_burn": round(adjusted_burn, 2),
        "hire_cost_monthly": round(hire_cost_monthly, 2),
        "cut_savings": round(cut_savings, 2),
        "gemma": gemma_result,
    }


@router.post("/analyze-document")
async def analyze_document(
    file: UploadFile = File(...),
    doc_type: str = Form(default="invoice"),
    user=Depends(optional_auth),
):
    """Upload and analyze a business document with Gemma 4 Vision."""
    company_id = get_company_id(user)
    db = get_db()

    # Read file
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(status_code=413, detail="File too large (max 10MB)")

    # Determine mime type
    filename = file.filename or "document"
    if filename.lower().endswith(".pdf"):
        mime_type = "application/pdf"
    elif filename.lower().endswith((".jpg", ".jpeg")):
        mime_type = "image/jpeg"
    elif filename.lower().endswith(".png"):
        mime_type = "image/png"
    else:
        mime_type = "application/pdf"

    # Base64 encode for Gemma
    b64_content = base64.b64encode(content).decode("utf-8")

    # Gemma analysis
    extracted = await gemma_service.analyze_document(b64_content, mime_type, doc_type)

    # Store in MongoDB — best-effort, never block the response
    try:
        db = get_db()
        doc = Document(
            company_id=company_id,
            filename=filename,
            file_type=doc_type,
            extracted_data={
                "vendor": extracted.get("vendor"),
                "amount": extracted.get("amount"),
                "due_date": extracted.get("due_date"),
                "payment_terms": extracted.get("payment_terms"),
                "flags": extracted.get("flags", []),
                "raw": extracted,
            },
            gemma_summary=extracted.get("risk_summary"),
            status="reviewed",
        )
        await db.documents.insert_one(doc.model_dump(by_alias=True))
        document_id = doc.id
    except Exception as db_err:
        print(f"DB unavailable, document not persisted: {db_err}")
        document_id = f"local-{filename}"

    return {
        "document_id": document_id,
        "filename": filename,
        "doc_type": doc_type,
        "extracted": extracted,
        "summary": extracted.get("risk_summary"),
        "recommended_action": extracted.get("recommended_action"),
        "flags": extracted.get("flags", []),
        "confidence": extracted.get("confidence", "medium"),
    }


@router.get("/documents")
async def list_documents(user=Depends(optional_auth)):
    """List all analyzed documents."""
    company_id = get_company_id(user)
    db = get_db()

    docs = await db.documents.find(
        {"company_id": company_id},
        sort=[("uploaded_at", -1)],
        limit=50,
    ).to_list(50)

    return {
        "documents": [
            {
                "id": str(d["_id"]),
                "filename": d.get("filename"),
                "file_type": d.get("file_type"),
                "uploaded_at": d.get("uploaded_at"),
                "status": d.get("status"),
                "summary": d.get("gemma_summary"),
                "flags_count": len(d.get("extracted_data", {}).get("flags", [])),
                "amount": d.get("extracted_data", {}).get("amount"),
            }
            for d in docs
        ]
    }

@router.get("/debug-snowflake")
async def debug_snowflake():
    from app.services.snowflake_service import snowflake_service
    
    # Test 1: just the attributes table alone
    rows1 = snowflake_service._query("""
        SELECT DISTINCT variable_name
        FROM SNOWFLAKE_PUBLIC_DATA.PUBLIC_DATA_FREE.FINANCIAL_ECONOMIC_INDICATORS_ATTRIBUTES
        LIMIT 20
    """)
    
    # Test 2: just the timeseries table alone
    rows2 = snowflake_service._query("""
        SELECT variable, value, date
        FROM SNOWFLAKE_PUBLIC_DATA.PUBLIC_DATA_FREE.FINANCIAL_ECONOMIC_INDICATORS_TIMESERIES
        LIMIT 5
    """)
    
    return {"attributes": rows1, "timeseries": rows2}