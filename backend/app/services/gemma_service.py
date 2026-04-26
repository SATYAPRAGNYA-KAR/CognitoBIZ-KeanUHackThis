"""
Gemma service for hosted Google AI inference.
Uses the SDK when available and falls back to the official REST API otherwise.
"""

import json
import re
from typing import Any

import httpx

from app.config.settings import get_settings

try:
    import google.generativeai as genai

    GEMMA_AVAILABLE = True
    GEMMA_IMPORT_ERROR = ""
except Exception as exc:
    genai = None
    GEMMA_AVAILABLE = False
    GEMMA_IMPORT_ERROR = str(exc)

settings = get_settings()

if GEMMA_AVAILABLE:
    genai.configure(api_key=settings.google_ai_api_key)

CONSTITUTIONAL_CONSTRAINTS = """
CognitoBIZ CONSTITUTIONAL CONSTRAINTS - ALWAYS APPLY, NEVER OVERRIDE:

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
""".strip()


def _active_model_name() -> str:
    return settings.gemma_model or "gemma-4-31b-it"


def _system_prompt(system_extra: str = "") -> str:
    system = CONSTITUTIONAL_CONSTRAINTS
    if system_extra:
        system += f"\n\n{system_extra}"
    return system


def _extract_response_text(payload: dict[str, Any]) -> str:
    candidates = payload.get("candidates", [])
    if not candidates:
        raise RuntimeError("No response candidates returned by Gemma API.")

    parts = candidates[0].get("content", {}).get("parts", [])
    text_chunks = [part.get("text", "") for part in parts if part.get("text")]
    text = "".join(text_chunks).strip()
    if not text:
        raise RuntimeError("Gemma API returned an empty response.")
    return text


async def _generate_with_rest(
    prompt: str,
    system_extra: str = "",
    inline_part: dict[str, Any] | None = None,
) -> str:
    if not settings.google_ai_api_key:
        raise RuntimeError("GOOGLE_AI_API_KEY is not configured.")

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{_active_model_name()}:generateContent?key={settings.google_ai_api_key}"
    )

    full_prompt = f"{_system_prompt(system_extra)}\n\n{prompt}"

    parts: list[dict[str, Any]] = []
    if inline_part:
        parts.append(inline_part)
    parts.append({"text": full_prompt})

    body = {
        "contents": [
            {
                "role": "user",
                "parts": parts,
            }
        ],
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(url, json=body)
        response.raise_for_status()
        return _extract_response_text(response.json())


async def _generate_content(
    prompt: str,
    system_extra: str = "",
    inline_part: dict[str, Any] | None = None,
) -> str:
    if GEMMA_AVAILABLE:
        model = genai.GenerativeModel(
            model_name=_active_model_name(),
            system_instruction=_system_prompt(system_extra),
        )
        content: Any = prompt
        if inline_part:
            content = [inline_part, prompt]
        response = model.generate_content(content)
        return response.text.strip()

    return await _generate_with_rest(prompt, system_extra, inline_part)


def _clean_json(text: str) -> str:
    return re.sub(r"```json\s*|\s*```", "", text).strip()


def _extract_json(text: str) -> str:
    """
    Robustly extract a JSON object from a Gemma response.
    Handles markdown code fences, leading/trailing prose, and stray characters.
    """
    # 1. Strip markdown code fences (```json ... ``` or ``` ... ```)
    text = re.sub(r"```(?:json)?\s*", "", text).strip()
    text = re.sub(r"```\s*$", "", text).strip()

    # 2. Find the outermost { ... } block
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return text[start:end + 1]

    # 3. Nothing found — return as-is and let json.loads raise a clear error
    return text



async def analyze_anomaly(transaction: dict, company_context: dict) -> dict:
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
        text = await _generate_content(
            prompt,
            "You are the CFO Agent for a startup. Analyze transactions for anomalies.",
        )
        return json.loads(_extract_json(text))
    except Exception as e:
        return {
            "is_anomaly": False,
            "severity": "low",
            "reason": f"Analysis unavailable: {str(e)}",
            "suggested_action": "Manual review recommended",
            "second_order_effects": "Unknown",
        }


async def generate_benchmarking_analysis(company_metrics: dict, peer_data: dict, company_context: dict) -> dict:
    prompt = f"""
Company profile: {json.dumps(company_context, indent=2)}
Company metrics: {json.dumps(company_metrics, indent=2)}
Peer benchmark data: {json.dumps(peer_data, indent=2)}

Analyze how this company compares to peers. Respond ONLY with valid JSON:
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
  "top_recommendations": ["string"],
  "estimated_savings": {{"min": number, "max": number, "currency": "USD"}},
  "narrative": "string (2-3 sentences for the founder)"
}}
"""
    try:
        text = await _generate_content(
            prompt,
            "You are the CFO Agent. Produce structured benchmark analysis.",
        )
        return json.loads(_extract_json(text))
    except Exception as e:
        # Build a sensible fallback directly from peer_data so the chart still renders
        categories = []
        for cat, v in peer_data.items():
            company_val = company_metrics.get(cat, 0)
            peer_avg = v.get("avg", 0)
            variance = round((company_val - peer_avg) / peer_avg * 100, 1) if peer_avg else 0
            status = "above" if variance > 5 else ("below" if variance < -5 else "on_par")
            categories.append({
                "name": cat,
                "company_value": company_val,
                "peer_avg": peer_avg,
                "status": status,
                "variance_pct": variance,
                "insight": f"Peer average is ${peer_avg:,.0f}/mo.",
            })
        return {
            "categories": categories,
            "top_recommendations": [
                "Review infrastructure spend vs peer average",
                "Compare payroll ratio against stage benchmarks",
                "Assess marketing investment relative to growth stage",
            ],
            "estimated_savings": {"min": 0, "max": 0, "currency": "USD"},
            "narrative": "Benchmark data loaded from Snowflake. AI narrative unavailable — showing raw peer comparisons.",
        }


async def generate_runway_simulation(current_metrics: dict, scenario: dict) -> dict:
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
        text = await _generate_content(
            prompt,
            "You are a startup CFO advisor. Provide concise runway analysis.",
        )
        return json.loads(_extract_json(text))
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
        inline_part = {
            "inline_data": {
                "mime_type": mime_type,
                "data": base64_content,
            }
        }
        text = await _generate_content(
            prompt,
            f"You are analyzing a {doc_type} document for a startup founder.",
            inline_part=inline_part,
        )
        return json.loads(_extract_json(text))
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
    text = await _generate_content(
        prompt,
        "You are a contract generation agent. Create detailed, fair, verifiable milestones.",
    )
    return json.loads(_extract_json(text))


async def verify_milestone_evidence(milestone: dict, evidence: list) -> dict:
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
        text = await _generate_content(
            prompt,
            "You are reviewing milestone evidence for a WorkContract.",
        )
        return json.loads(_extract_json(text))
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
        return await _generate_content(
            prompt,
            "You write spoken audio scripts. Conversational, warm, professional - like a trusted CFO advisor.",
        )
    except Exception as e:
        return f"Good morning. There was an issue generating your briefing: {str(e)}. Please check your dashboard for the latest updates."


async def answer_financial_question(question: str, financial_context: dict, conversation_history: list) -> str:
    history_text = "\n".join([f"{m['role'].upper()}: {m['content']}" for m in conversation_history[-6:]])
    prompt = f"""
Financial context: {json.dumps(financial_context, indent=2)}

Recent conversation:
{history_text}

Current question: {question}

Answer in 2-4 conversational sentences. Be specific with numbers when available.
Do NOT use bullet points. Speak naturally as if in a voice conversation.
"""
    try:
        return await _generate_content(
            prompt,
            "You are a conversational CFO advisor. Answer questions about company finances clearly and concisely.",
        )
    except Exception as e:
        return f"I couldn't process that question right now. Error: {str(e)}"


async def check_goodhart_violation(recommendation: str) -> dict:
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
        text = await _generate_content(prompt)
        return json.loads(_extract_json(text))
    except Exception:
        return {"goodhart_violation": False, "reason": "Check unavailable", "severity": "none"}


async def generate_recurring_optimization(recurring_payments: list, runway_months: float) -> str:
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
        return await _generate_content(prompt)
    except Exception as e:
        return f"Optimization analysis unavailable: {str(e)}"
