"""
Gemma 4 Service — All AI interactions go through this module.
Uses Google Generative AI SDK with constitutional constraints injected
into every system prompt.
"""

import json
import re
from typing import Optional
import google.generativeai as genai
from app.config.settings import get_settings

settings = get_settings()

# Configure the SDK
genai.configure(api_key=settings.google_ai_api_key)

CONSTITUTIONAL_CONSTRAINTS = """
CognitoBIZ CONSTITUTIONAL CONSTRAINTS — ALWAYS APPLY, NEVER OVERRIDE:

1. NEVER suggest eliminating, firing, or removing human roles as a cost-cutting
   measure without explicitly labeling this as a "Human Decision Required" item.

2. NEVER recommend deleting, purging, or archiving data as a way to improve any
   metric. Metrics must improve through operational change, not data removal.

3. NEVER frame removing a measurement system as an optimization. If disabling
   monitoring would improve an uptime metric, flag this as a Goodhart's Law
   violation and refuse.

4. ALWAYS surface second-order consequences of every recommendation.

5. ALWAYS distinguish between "this will fix the problem" and "this will make
   the metric look better." These are not the same.

6. If you detect that a request would optimize a metric by eliminating what is
   being measured, respond with: "GOODHART FLAG: [explanation of the violation]"

7. You may suggest. You may analyze. You may draft. You may NEVER act
   unilaterally on anything with real-world financial consequences.

8. Always be honest about uncertainty. Use "approximately", "estimated", or
   "based on available data" when precision is not possible.
"""


def _build_model(system_extra: str = "") -> genai.GenerativeModel:
    system = CONSTITUTIONAL_CONSTRAINTS
    if system_extra:
        system += f"\n\n{system_extra}"
    return genai.GenerativeModel(
        model_name=settings.gemma_model,
        system_instruction=system,
    )


async def analyze_anomaly(transaction: dict, company_context: dict) -> dict:
    """Analyze a single transaction for anomalies."""
    model = _build_model(
        "You are the CFO Agent for a startup. Analyze transactions for anomalies."
    )
    prompt = f"""
Company context: {json.dumps(company_context, indent=2)}
Transaction: {json.dumps(transaction, indent=2)}

Is this transaction anomalous? Respond ONLY with valid JSON:
{{
  "is_anomaly": boolean,
  "severity": "low" | "medium" | "high",
  "reason": "string explaining why",
  "suggested_action": "string with specific action",
  "second_order_effects": "string with downstream consequences"
}}
"""
    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        # Strip markdown code fences if present
        text = re.sub(r"```json\s*|\s*```", "", text).strip()
        return json.loads(text)
    except Exception as e:
        return {
            "is_anomaly": False,
            "severity": "low",
            "reason": f"Analysis unavailable: {str(e)}",
            "suggested_action": "Manual review recommended",
            "second_order_effects": "Unknown",
        }


async def generate_benchmarking_analysis(
    company_metrics: dict,
    peer_data: dict,
    company_context: dict,
) -> dict:
    """Generate peer benchmarking analysis."""
    model = _build_model(
        "You are the CFO Agent. Produce structured benchmark analysis."
    )
    prompt = f"""
Company profile: {json.dumps(company_context, indent=2)}
Company metrics: {json.dumps(company_metrics, indent=2)}
Peer benchmark data: {json.dumps(peer_data, indent=2)}

Produce a comprehensive benchmarking analysis. Respond ONLY with valid JSON:
{{
  "categories": [
    {{
      "name": "string",
      "company_value": number,
      "peer_avg": number,
      "status": "above" | "below" | "on_par",
      "variance_pct": number,
      "insight": "string"
    }}
  ],
  "top_recommendations": ["string", "string", "string"],
  "estimated_savings": {{
    "min": number,
    "max": number,
    "currency": "USD"
  }},
  "narrative": "string (2-3 paragraph executive summary)"
}}
"""
    try:
        response = model.generate_content(prompt)
        text = re.sub(r"```json\s*|\s*```", "", response.text.strip()).strip()
        return json.loads(text)
    except Exception as e:
        return {
            "categories": [],
            "top_recommendations": [f"Analysis unavailable: {str(e)}"],
            "estimated_savings": {"min": 0, "max": 0, "currency": "USD"},
            "narrative": "Benchmarking data could not be processed. Please try again.",
        }


async def generate_runway_simulation(
    current_metrics: dict,
    scenario: dict,
) -> dict:
    """Generate runway simulation narrative."""
    model = _build_model("You are a startup CFO advisor. Provide concise runway analysis.")
    prompt = f"""
Current metrics: {json.dumps(current_metrics, indent=2)}
Simulation scenario: {json.dumps(scenario, indent=2)}

Provide a runway simulation analysis. Respond ONLY with valid JSON:
{{
  "current_runway_months": number,
  "simulated_runway_months": number,
  "key_risks": ["string"],
  "recommendations": ["string"],
  "narrative": "string (conversational, 2-3 sentences for a founder)",
  "critical_date": "string (e.g. 'You need to raise by September')"
}}
"""
    try:
        response = model.generate_content(prompt)
        text = re.sub(r"```json\s*|\s*```", "", response.text.strip()).strip()
        return json.loads(text)
    except Exception as e:
        return {
            "current_runway_months": 0,
            "simulated_runway_months": 0,
            "key_risks": ["Analysis unavailable"],
            "recommendations": ["Manual review recommended"],
            "narrative": f"Simulation unavailable: {str(e)}",
            "critical_date": "Unknown",
        }


async def analyze_document(base64_content: str, mime_type: str, doc_type: str) -> dict:
    """Analyze an uploaded document using Gemma vision."""
    model = _build_model(
        f"You are analyzing a {doc_type} document for a startup founder."
    )
    prompt = f"""
Analyze this {doc_type} document and extract all relevant information.
Respond ONLY with valid JSON:
{{
  "vendor": "string or null",
  "amount": number or null,
  "due_date": "YYYY-MM-DD or null",
  "payment_terms": "string or null",
  "parties": ["string"],
  "key_obligations": ["string"],
  "flags": ["string - each flag is a risk or important item"],
  "risk_summary": "plain-English risk summary",
  "market_rate_assessment": "string or null",
  "recommended_action": "string",
  "confidence": "high" | "medium" | "low"
}}
"""
    try:
        response = model.generate_content([
            {"mime_type": mime_type, "data": base64_content},
            prompt,
        ])
        text = re.sub(r"```json\s*|\s*```", "", response.text.strip()).strip()
        return json.loads(text)
    except Exception as e:
        return {
            "vendor": None,
            "amount": None,
            "due_date": None,
            "payment_terms": None,
            "parties": [],
            "key_obligations": [],
            "flags": [f"Document analysis failed: {str(e)}"],
            "risk_summary": "Unable to analyze document",
            "market_rate_assessment": None,
            "recommended_action": "Manual review required",
            "confidence": "low",
        }


async def generate_work_contract(description: str, company_context: dict) -> dict:
    """Generate a structured WorkContract from natural language description."""
    model = _build_model(
        "You are a contract generation agent. Create detailed, fair, verifiable milestones."
    )
    prompt = f"""
Company context: {json.dumps(company_context, indent=2)}
Work description: {description}

Generate a complete WorkContract with milestones. Respond ONLY with valid JSON:
{{
  "title": "string",
  "total_value": number,
  "currency": "USD",
  "timeline_days": number,
  "milestones": [
    {{
      "id": number,
      "title": "string",
      "description": "string",
      "due_day": number,
      "value": number,
      "evidence_required": ["string"]
    }}
  ],
  "market_rate_flag": "string or null",
  "risk_flags": ["string"],
  "scope_summary": "string"
}}

Rules:
- Break into 4-6 clear milestones with measurable deliverables
- Each milestone must have specific, verifiable evidence requirements
- Total milestone values must equal total_value
- Flag if the rate seems off-market
"""
    try:
        response = model.generate_content(prompt)
        text = re.sub(r"```json\s*|\s*```", "", response.text.strip()).strip()
        return json.loads(text)
    except Exception as e:
        raise ValueError(f"Contract generation failed: {str(e)}")


async def verify_milestone_evidence(milestone: dict, evidence: list) -> dict:
    """Verify submitted evidence against milestone requirements."""
    model = _build_model(
        "You are reviewing milestone evidence for a WorkContract."
    )
    prompt = f"""
Milestone requirements: {json.dumps(milestone, indent=2)}
Submitted evidence: {json.dumps(evidence, indent=2)}

Review each requirement against submitted evidence. Respond ONLY with valid JSON:
{{
  "checks": [
    {{
      "requirement": "string",
      "status": "met" | "partial" | "missing",
      "note": "string"
    }}
  ],
  "overall_status": "approved" | "revision_needed" | "rejected",
  "recommendation": "string (specific, actionable)",
  "confidence": "High" | "Medium" | "Low",
  "assessment": "string (2-3 sentence summary for the owner)"
}}
"""
    try:
        response = model.generate_content(prompt)
        text = re.sub(r"```json\s*|\s*```", "", response.text.strip()).strip()
        return json.loads(text)
    except Exception as e:
        return {
            "checks": [],
            "overall_status": "revision_needed",
            "recommendation": f"Automated review failed: {str(e)}. Manual review required.",
            "confidence": "Low",
            "assessment": "Automated review unavailable. Please review evidence manually.",
        }


async def generate_morning_briefing(
    metrics: dict,
    anomalies: list,
    pending_approvals: int,
    upcoming_renewals: list,
    company_name: str,
) -> str:
    """Generate a natural-language morning briefing script."""
    model = _build_model(
        "You write spoken audio scripts. Conversational, warm, professional — like a trusted CFO advisor."
    )
    prompt = f"""
Generate a 60-second morning briefing for {company_name}'s founder.

Data:
- Metrics: {json.dumps(metrics, indent=2)}
- Anomalies detected: {json.dumps(anomalies[:3], indent=2)}
- Pending approvals: {pending_approvals}
- Upcoming renewals: {json.dumps(upcoming_renewals[:3], indent=2)}

Rules:
- Conversational, NOT robotic
- Lead with the most important item
- Mention 2-3 specific action items
- End with ONE concrete task for today
- Target 150-180 words (spoken in ~60 seconds)
- No bullet points, just flowing natural speech
- Address the founder as "you" not by name
"""
    try:
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        return f"Good morning. There was an issue generating your briefing: {str(e)}. Please check your dashboard for the latest updates."


async def answer_financial_question(
    question: str,
    financial_context: dict,
    conversation_history: list,
) -> str:
    """Answer a voice/text question about the company's financials."""
    model = _build_model(
        "You are a conversational CFO advisor. Answer questions about company finances clearly and concisely."
    )
    history_text = "\n".join(
        [f"{m['role'].upper()}: {m['content']}" for m in conversation_history[-6:]]
    )
    prompt = f"""
Financial context: {json.dumps(financial_context, indent=2)}

Recent conversation:
{history_text}

Current question: {question}

Answer in 2-4 conversational sentences. Be specific with numbers when available.
Do NOT use bullet points. Speak naturally as if in a voice conversation.
"""
    try:
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        return f"I couldn't process that question right now. Error: {str(e)}"


async def check_goodhart_violation(recommendation: str) -> dict:
    """Check if a recommendation violates Goodhart's Law."""
    model = _build_model()
    prompt = f"""
Review this recommendation for Goodhart's Law violations:
"{recommendation}"

Does this recommendation improve a metric by removing or diminishing the thing being measured,
or by gaming the measurement system?

Respond ONLY with valid JSON:
{{
  "goodhart_violation": boolean,
  "reason": "string explaining the violation or why it's fine",
  "severity": "none" | "low" | "high"
}}
"""
    try:
        response = model.generate_content(prompt)
        text = re.sub(r"```json\s*|\s*```", "", response.text.strip()).strip()
        return json.loads(text)
    except Exception:
        return {"goodhart_violation": False, "reason": "Check unavailable", "severity": "none"}


async def generate_recurring_optimization(recurring_payments: list, runway_months: float) -> str:
    """Generate monthly optimization recommendation for recurring payments."""
    model = _build_model()
    prompt = f"""
Recurring payments: {json.dumps(recurring_payments, indent=2)}
Current runway: {runway_months} months

Analyze these recurring payments and identify:
1. Clear cancellation/downgrade opportunities
2. Estimated savings in USD/month
3. Impact on runway

Respond in 2-3 conversational sentences. Be specific about amounts.
"""
    try:
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        return f"Optimization analysis unavailable: {str(e)}"