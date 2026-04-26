from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse

from auth0_server_python.auth_types import LogoutOptions, StartInteractiveLoginOptions

from app.config.settings import get_settings
from app.services.auth0_service import (
    Auth0ConfigurationError,
    apply_auth0_cookies,
    get_auth0_client,
    get_auth0_user,
)

router = APIRouter(tags=["auth"])
api_router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/login")
async def login(request: Request):
    try:
        url = await get_auth0_client().start_interactive_login(
            options=StartInteractiveLoginOptions(
                authorization_params=dict(request.query_params),
            ),
            store_options={"request": request},
        )
    except Auth0ConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    response = RedirectResponse(url=url, status_code=302)
    return apply_auth0_cookies(request, response)


@router.get("/callback")
async def callback(request: Request):
    settings = get_settings()
    try:
        await get_auth0_client().complete_interactive_login(
            url=str(request.url),
            store_options={"request": request},
        )
    except Auth0ConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Auth0 callback failed") from exc

    response = RedirectResponse(url=f"{settings.frontend_url}/dashboard", status_code=302)
    return apply_auth0_cookies(request, response)


@router.get("/logout")
async def logout(request: Request):
    settings = get_settings()
    return_to = settings.frontend_url.rstrip("/")
    try:
        url = await get_auth0_client().logout(
            options=LogoutOptions(return_to=return_to),
            store_options={"request": request},
        )
    except Auth0ConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    response = RedirectResponse(url=url, status_code=302)
    return apply_auth0_cookies(request, response)


@api_router.get("/me")
async def me(request: Request):
    user = await get_auth0_user(request)
    return JSONResponse({"authenticated": bool(user), "user": user})
