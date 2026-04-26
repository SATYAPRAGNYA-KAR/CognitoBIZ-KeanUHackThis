"""CognitoBIZ AI — FastAPI Application Entry Point"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from contextlib import asynccontextmanager

from app.config.mongodb import connect_db, close_db
from app.config.settings import get_settings
from app.middleware.errorHandler import (
    http_exception_handler,
    validation_exception_handler,
    unhandled_exception_handler,
)
from app.routers.dashboard import router as dashboard_router
from app.routers.intelligence import router as intelligence_router
from app.routers.contracts import router as contracts_router
from app.routers.agents import router as agents_router
from app.routers.guardrails import router as guardrails_router
from app.routers.voice import router as voice_router
from app.routers.audit import router as audit_router
from app.routers.payments import router as payments_router
from app.routers.vendor import router as vendor_router
from app.routers.company import notifications_router, company_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
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

# Exception handlers
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

# Register all routers under /api
app.include_router(dashboard_router, prefix="/api")
app.include_router(intelligence_router, prefix="/api")
app.include_router(contracts_router, prefix="/api")
app.include_router(agents_router, prefix="/api")
app.include_router(guardrails_router, prefix="/api")
app.include_router(voice_router, prefix="/api")
app.include_router(audit_router, prefix="/api")
app.include_router(payments_router, prefix="/api")
app.include_router(vendor_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")
app.include_router(company_router, prefix="/api")


@app.get("/")
async def root():
    return {
        "app": "CognitoBIZ AI",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "healthy", "environment": settings.environment}