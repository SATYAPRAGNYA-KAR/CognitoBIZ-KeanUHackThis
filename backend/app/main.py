"""CognitoBIZ AI - FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, Response
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config.mongodb import close_db, connect_db
from app.config.settings import get_settings
from app.routers.agents import router as agents_router
from app.routers.audit import router as audit_router
from app.routers.auth0 import api_router as auth_api_router, router as auth_router
from app.routers.company import company_router, notifications_router
from app.routers.contracts import router as contracts_router
from app.routers.dashboard import router as dashboard_router
from app.routers.guardrails import router as guardrails_router
from app.routers.intelligence import router as intelligence_router
from app.routers.payments import router as payments_router
from app.routers.solana import router as solana_router
from app.routers.voice import router as voice_router

from app.jobs.etl_job import run_full_etl
try:
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
except Exception:
    AsyncIOScheduler = None

scheduler = AsyncIOScheduler() if AsyncIOScheduler else None
settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    if scheduler:
        scheduler.add_job(run_full_etl, 'interval', hours=24, id='etl_sync')
        scheduler.start()
    yield
    if scheduler:
        scheduler.shutdown()
    await close_db()


app = FastAPI(
    title="CognitoBIZ AI",
    description="Governed AI Chief of Staff for Startups & SMBs",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard_router, prefix="/api")
app.include_router(intelligence_router, prefix="/api")
app.include_router(contracts_router, prefix="/api")
app.include_router(agents_router, prefix="/api")
app.include_router(guardrails_router, prefix="/api")
app.include_router(voice_router, prefix="/api")
app.include_router(audit_router, prefix="/api")
app.include_router(solana_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")
app.include_router(company_router, prefix="/api")
app.include_router(auth_api_router, prefix="/api")
app.include_router(auth_router)
app.include_router(payments_router, prefix="/api")

@app.get("/", response_class=HTMLResponse)
async def root():
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>CognitoBIZ AI</title>
      <style>
        :root {
          --bg: #f4efe7;
          --card: #fffaf4;
          --ink: #1e2a2f;
          --muted: #5c6b70;
          --accent: #0d7a6f;
          --border: #d9cfc1;
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 24px;
          background:
            radial-gradient(circle at top left, rgba(224, 164, 88, 0.18), transparent 28%),
            radial-gradient(circle at bottom right, rgba(13, 122, 111, 0.16), transparent 30%),
            var(--bg);
          color: var(--ink);
          font-family: Georgia, "Times New Roman", serif;
        }
        .card {
          width: min(760px, 100%);
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 24px;
          padding: 32px;
          box-shadow: 0 20px 60px rgba(30, 42, 47, 0.08);
        }
        .eyebrow {
          margin: 0 0 12px;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          font-size: 12px;
          color: var(--muted);
        }
        h1 {
          margin: 0 0 12px;
          font-size: clamp(36px, 6vw, 56px);
          line-height: 0.95;
        }
        p {
          margin: 0 0 24px;
          font-size: 18px;
          line-height: 1.6;
          color: var(--muted);
        }
        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 24px;
        }
        a.button {
          display: inline-block;
          text-decoration: none;
          padding: 12px 18px;
          border-radius: 999px;
          border: 1px solid var(--border);
          color: var(--ink);
          background: white;
          font-weight: 700;
        }
        a.button.primary {
          background: var(--accent);
          border-color: var(--accent);
          color: white;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
        }
        .tile {
          border: 1px solid var(--border);
          border-radius: 18px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.75);
        }
        .tile strong {
          display: block;
          margin-bottom: 6px;
        }
        code {
          font-family: Consolas, monospace;
          background: rgba(30, 42, 47, 0.06);
          padding: 2px 6px;
          border-radius: 6px;
        }
      </style>
    </head>
    <body>
      <main class="card">
        <p class="eyebrow">CognitoBIZ AI</p>
        <h1>Backend is live on port 8000.</h1>
        <p>
          The FastAPI backend is running. Use the links below to sign in with Auth0,
          inspect the API, or verify the current session.
        </p>
        <div class="actions">
          <a class="button primary" href="/login">Log In</a>
          <a class="button" href="/docs">API Docs</a>
          <a class="button" href="/api/auth/me">Session Check</a>
          <a class="button" href="/health">Health</a>
        </div>
        <div class="grid">
          <section class="tile">
            <strong>Auth</strong>
            <span><code>/login</code>, <code>/callback</code>, <code>/logout</code></span>
          </section>
          <section class="tile">
            <strong>API</strong>
            <span>Product endpoints live under <code>/api/*</code></span>
          </section>
          <section class="tile">
            <strong>Docs</strong>
            <span>OpenAPI is available at <code>/docs</code></span>
          </section>
        </div>
      </main>
    </body>
    </html>
    """


@app.get("/health")
async def health():
    return {"status": "healthy", "environment": settings.environment}


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(status_code=204)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    wants_html = "text/html" in request.headers.get("accept", "")

    if exc.status_code == 404 and wants_html and not request.url.path.startswith("/api"):
        return HTMLResponse(
            f"""
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <title>Page Not Found</title>
              <style>
                body {{
                  margin: 0;
                  min-height: 100vh;
                  display: grid;
                  place-items: center;
                  padding: 24px;
                  background: #f6f2eb;
                  color: #1f2b30;
                  font-family: Georgia, "Times New Roman", serif;
                }}
                .panel {{
                  max-width: 720px;
                  width: 100%;
                  background: white;
                  border: 1px solid #ddd2c4;
                  border-radius: 24px;
                  padding: 32px;
                  box-shadow: 0 18px 48px rgba(31, 43, 48, 0.08);
                }}
                h1 {{ margin-top: 0; font-size: 40px; }}
                p {{ line-height: 1.6; color: #5a686d; }}
                a {{
                  display: inline-block;
                  margin-right: 12px;
                  margin-top: 8px;
                  text-decoration: none;
                  color: white;
                  background: #0d7a6f;
                  padding: 12px 18px;
                  border-radius: 999px;
                }}
                code {{
                  background: #f2eee7;
                  padding: 2px 6px;
                  border-radius: 6px;
                }}
              </style>
            </head>
            <body>
              <main class="panel">
                <h1>That page does not exist.</h1>
                <p>
                  The backend is running, but there is no route for
                  <code>{request.url.path}</code>.
                </p>
                <p>
                  If you expected the app UI here, the frontend is not being served from this
                  backend yet. For now, use the backend entry points below.
                </p>
                <a href="/">Home</a>
                <a href="/docs">API Docs</a>
                <a href="/login">Log In</a>
              </main>
            </body>
            </html>
            """,
            status_code=404,
        )

    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)
