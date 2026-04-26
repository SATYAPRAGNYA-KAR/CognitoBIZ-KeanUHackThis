from functools import lru_cache
from typing import Any

from auth0_server_python.auth_server.server_client import ServerClient
from auth0_server_python.auth_types import StateData, TransactionData
from auth0_server_python.store.abstract import AbstractDataStore
from fastapi import Request, Response

from app.config.settings import get_settings


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
    settings = get_settings()
    missing = []
    if not settings.auth0_domain:
        missing.append("AUTH0_DOMAIN")
    if not settings.auth0_client_id:
        missing.append("AUTH0_CLIENT_ID")
    if not settings.auth0_client_secret:
        missing.append("AUTH0_CLIENT_SECRET")
    if not settings.auth0_secret:
        missing.append("AUTH0_SECRET")
    if not settings.app_base_url:
        missing.append("APP_BASE_URL")

    if missing:
        raise Auth0ConfigurationError(
            "Missing required Auth0 settings: " + ", ".join(missing)
        )

    return ServerClient(
        domain=settings.auth0_domain,
        client_id=settings.auth0_client_id,
        client_secret=settings.auth0_client_secret,
        redirect_uri=f"{settings.app_base_url}/callback",
        authorization_params={"scope": "openid profile email"},
        secret=settings.auth0_secret,
        state_store=CookieStore(settings.auth0_secret, "_a0_session", 259200, StateData),
        transaction_store=CookieStore(settings.auth0_secret, "_a0_tx", 300, TransactionData),
    )


def apply_auth0_cookies(request: Request, response: Response) -> Response:
    settings = get_settings()
    secure = not settings.app_base_url.startswith("http://")

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
