import httpx
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from app.config.settings import get_settings
from functools import lru_cache

settings = get_settings()
bearer_scheme = HTTPBearer(auto_error=False)


@lru_cache()
def get_jwks() -> dict:
    """Fetch Auth0 JWKS (cached)."""
    url = f"https://{settings.auth0_domain}/.well-known/jwks.json"
    resp = httpx.get(url, timeout=10)
    resp.raise_for_status()
    return resp.json()


def verify_token(token: str) -> dict:
    """Decode and verify an Auth0 JWT."""
    try:
        jwks = get_jwks()
        unverified_header = jwt.get_unverified_header(token)
        rsa_key = {}
        for key in jwks.get("keys", []):
            if key.get("kid") == unverified_header.get("kid"):
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"],
                }
        if not rsa_key:
            raise HTTPException(status_code=401, detail="Unable to find appropriate key")

        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=[settings.auth0_algorithms],
            audience=settings.auth0_audience,
            issuer=f"https://{settings.auth0_domain}/",
        )
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """Extract current user from Bearer token."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authorization required")
    return verify_token(credentials.credentials)


def require_scope(required_scope: str):
    """Dependency factory: verify the token has a specific scope."""
    async def check_scope(
        user: dict = Depends(get_current_user),
    ) -> dict:
        scopes = user.get("scope", "").split()
        if required_scope not in scopes:
            raise HTTPException(
                status_code=403,
                detail=f"Missing required scope: {required_scope}",
            )
        return user
    return check_scope


def require_role(role: str):
    """Dependency factory: check user role from JWT custom claim."""
    async def check_role(user: dict = Depends(get_current_user)) -> dict:
        user_role = user.get(f"https://cognitobiz.ai/role", "")
        if user_role != role and role != "any":
            raise HTTPException(
                status_code=403,
                detail=f"Requires role: {role}",
            )
        return user
    return check_role


# Optional auth — returns None if no token (for demo/dev)
async def optional_auth(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict | None:
    if credentials is None:
        return None
    try:
        return verify_token(credentials.credentials)
    except HTTPException:
        return None