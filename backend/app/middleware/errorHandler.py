"""
Global error handler middleware for FastAPI.
Catches unhandled exceptions and returns structured JSON responses.
"""

from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import traceback


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail, "status_code": exc.status_code},
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = []
    for error in exc.errors():
        errors.append({
            "field": " -> ".join(str(loc) for loc in error["loc"]),
            "message": error["msg"],
            "type": error["type"],
        })
    return JSONResponse(
        status_code=422,
        content={"error": "Validation error", "details": errors, "status_code": 422},
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    print(f"Unhandled exception on {request.method} {request.url}: {exc}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "status_code": 500},
    )