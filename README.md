# CognitoBIZ AI — Governed AI Chief of Staff

A full-stack AI-powered financial operating system for startups and SMBs.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Recharts |
| Backend | Python 3.11, FastAPI, Motor (async MongoDB) |
| AI | Google Gemma 4 (via Google AI SDK) |
| Database | MongoDB Atlas |
| Analytics | Snowflake |
| Payments | Solana (Devnet) |
| Voice | ElevenLabs |
| Auth | Auth0 |

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- MongoDB Atlas cluster
- Auth0 account
- Google AI API key (Gemma 4)
- Solana Devnet wallet
- ElevenLabs API key
- Snowflake account

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Fill in your .env values
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env.local
# Fill in your .env.local values
npm run dev
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                    │
│         Dashboard │ WorkContracts │ Audit │ Voice        │
└────────────────────────┬────────────────────────────────┘
                         │ REST / WebSocket
┌────────────────────────▼────────────────────────────────┐
│                   BACKEND (FastAPI / Python)             │
│      Agent Dispatcher │ Action Router │ HITL Engine      │
└──┬──────────┬─────────┬──────────┬───────────┬──────────┘
   │          │         │          │           │
Auth0    MongoDB     Snowflake   Gemma 4    Solana Devnet
Agent     Atlas     Analytics    Vision     Escrow+Audit
Auth      Live                   +Text
          State
```

## Module Overview

1. **Authentication & Agent Identity** — Auth0 human + M2M agent auth
2. **Company Onboarding** — Profile setup + financial data ingestion
3. **Live Financial Pulse** — Real-time dashboard with anomaly detection
4. **Intelligence Engine** — Peer benchmarking, runway simulator, doc analysis
5. **WorkContracts** — Milestone-based vendor contracts with Solana escrow
6. **Action Layer** — Payment queue, invoice management, recurring detection
7. **Guardrail System** — Constitutional AI constraints + Goodhart's Law detection
8. **Voice Layer** — ElevenLabs morning briefings + voice Q&A
9. **Audit Center** — MongoDB + Solana immutable audit trail
10. **Notifications** — Real-time alerts for all critical events