from functools import lru_cache
import time
from typing import Any, Optional

import httpx
from auth0_server_python.auth_server.server_client import ServerClient
from auth0_server_python.auth_types import StateData, TransactionData
from auth0_server_python.store.abstract import AbstractDataStore
from fastapi import Request, Response

from app.config.settings import get_settings


settings = get_settings()

# Token cache: { client_id: { "access_token": str, "expires_at": float } }
_token_cache: dict[str, dict[str, Any]] = {}


class Auth0ConfigurationError(RuntimeError):
    pass


def _extract_request(options: dict[str, Any] | None = None, **kwargs: Any) -> Request | None:
    if isinstance(options, dict) and isinstance(options.get("request"), Request):
        return options["request"]

    if isinstance(kwargs.get("request"), Request):
        return kwargs["request"]

    nested_options = kwargs.get("options")
    if isinstance(nested_options, dict) and isinstance(nested_options.get("request"), Request):
        return nested_options["request"]

    return None


class CookieStore(AbstractDataStore):
    def __init__(self, secret: str, cookie_name: str, max_age: int, model: type[Any]):
        super().__init__({"secret": secret})
        self.cookie_name = cookie_name
        self.max_age = max_age
        self.model = model

    async def set(
        self,
        identifier: str,
        state: Any,
        remove_if_expires: bool = False,
        options: dict[str, Any] | None = None,
    ) -> None:
        _ = remove_if_expires
        request = _extract_request(options=options)
        if request is None:
            return

        data = state.model_dump() if hasattr(state, "model_dump") else state
        cookie_ops = getattr(request.state, "auth0_cookie_ops", [])
        cookie_ops.append(
            {
                "action": "set",
                "name": self.cookie_name,
                "value": self.encrypt(identifier, data),
                "max_age": self.max_age,
            }
        )
        request.state.auth0_cookie_ops = cookie_ops

    async def get(self, identifier: str, options: dict[str, Any] | None = None) -> Any | None:
        request = _extract_request(options=options)
        if request is None:
            return None

        try:
            encrypted = request.cookies.get(self.cookie_name)
            if not encrypted:
                return None
            decrypted = self.decrypt(identifier, encrypted)
            return self.model.model_validate(decrypted)
        except Exception:
            return None

    async def delete(self, identifier: str, options: dict[str, Any] | None = None) -> None:
        request = _extract_request(options=options)
        if request is None:
            return

        cookie_ops = getattr(request.state, "auth0_cookie_ops", [])
        cookie_ops.append({"action": "delete", "name": self.cookie_name})
        request.state.auth0_cookie_ops = cookie_ops


@lru_cache()
def get_auth0_client() -> ServerClient:
    current_settings = get_settings()
    missing = []
    if not current_settings.auth0_domain:
        missing.append("AUTH0_DOMAIN")
    if not current_settings.auth0_client_id:
        missing.append("AUTH0_CLIENT_ID")
    if not current_settings.auth0_client_secret:
        missing.append("AUTH0_CLIENT_SECRET")
    if not current_settings.auth0_secret:
        missing.append("AUTH0_SECRET")
    if not current_settings.app_base_url:
        missing.append("APP_BASE_URL")

    if missing:
        raise Auth0ConfigurationError(
            "Missing required Auth0 settings: " + ", ".join(missing)
        )

    return ServerClient(
        domain=current_settings.auth0_domain,
        client_id=current_settings.auth0_client_id,
        client_secret=current_settings.auth0_client_secret,
        redirect_uri=f"{current_settings.app_base_url}/callback",
        authorization_params={"scope": "openid profile email"},
        secret=current_settings.auth0_secret,
        state_store=CookieStore(current_settings.auth0_secret, "_a0_session", 259200, StateData),
        transaction_store=CookieStore(current_settings.auth0_secret, "_a0_tx", 300, TransactionData),
    )


def apply_auth0_cookies(request: Request, response: Response) -> Response:
    current_settings = get_settings()
    secure = not current_settings.app_base_url.startswith("http://")

    for operation in getattr(request.state, "auth0_cookie_ops", []):
        if operation["action"] == "set":
            response.set_cookie(
                operation["name"],
                operation["value"],
                httponly=True,
                samesite="lax",
                secure=secure,
                max_age=operation["max_age"],
            )
        elif operation["action"] == "delete":
            response.delete_cookie(operation["name"])

    request.state.auth0_cookie_ops = []
    return response


async def get_auth0_user(request: Request) -> dict[str, Any] | None:
    try:
        return await get_auth0_client().get_user(store_options={"request": request})
    except Auth0ConfigurationError:
        return None


class Auth0Service:
    def __init__(self):
        self.domain = settings.auth0_domain
        self.base_url = f"https://{self.domain}" if self.domain else "https://your-domain.auth0.com"

    async def get_agent_token(
        self,
        client_id: str,
        client_secret: str,
        audience: Optional[str] = None,
    ) -> str:
        aud = audience or settings.auth0_audience
        cache_key = f"{client_id}:{aud}"

        cached = _token_cache.get(cache_key)
        if cached and cached["expires_at"] > time.time() + 60:
            return str(cached["access_token"])

        token_data = await self._fetch_token(client_id, client_secret, aud)
        _token_cache[cache_key] = {
            "access_token": token_data["access_token"],
            "expires_at": time.time() + token_data.get("expires_in", 86400),
        }
        return str(token_data["access_token"])

    async def _fetch_token(self, client_id: str, client_secret: str, audience: str) -> dict[str, Any]:
        if not self.domain:
            return {
                "access_token": f"mock_m2m_token_{client_id[:8]}",
                "expires_in": 86400,
                "token_type": "Bearer",
            }

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{self.base_url}/oauth/token",
                json={
                    "grant_type": "client_credentials",
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "audience": audience,
                },
            )
            resp.raise_for_status()
            return resp.json()

    async def get_user_info(self, access_token: str) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{self.base_url}/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            resp.raise_for_status()
            return resp.json()

    async def verify_token_scopes(self, token: str, required_scopes: list[str]) -> bool:
        try:
            from jose import jwt

            payload = jwt.get_unverified_claims(token)
            token_scopes = payload.get("scope", "").split()
            return all(scope in token_scopes for scope in required_scopes)
        except Exception:
            return False

    def get_management_api_url(self) -> str:
        return f"{self.base_url}/api/v2"

    async def list_m2m_applications(self, mgmt_token: str) -> list[Any]:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{self.get_management_api_url()}/clients",
                headers={"Authorization": f"Bearer {mgmt_token}"},
                params={"app_type": "non_interactive"},
            )
            if resp.status_code != 200:
                return []
            return resp.json()


auth0_service = Auth0Service()
