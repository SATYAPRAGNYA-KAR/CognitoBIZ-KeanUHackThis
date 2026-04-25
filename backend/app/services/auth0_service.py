"""
Auth0 Service — Machine-to-Machine token management for AI agents.
Issues and caches access tokens for each agent's Auth0 M2M application.
"""

import httpx
import time
from typing import Optional
from functools import lru_cache
from app.config.settings import get_settings

settings = get_settings()

# Token cache: { client_id: { "access_token": str, "expires_at": float } }
_token_cache: dict[str, dict] = {}


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
        """
        Get a cached M2M access token for an agent.
        Automatically refreshes 60 seconds before expiry.
        """
        aud = audience or settings.auth0_audience
        cache_key = f"{client_id}:{aud}"

        # Check cache
        cached = _token_cache.get(cache_key)
        if cached and cached["expires_at"] > time.time() + 60:
            return cached["access_token"]

        # Fetch new token
        token_data = await self._fetch_token(client_id, client_secret, aud)
        _token_cache[cache_key] = {
            "access_token": token_data["access_token"],
            "expires_at": time.time() + token_data.get("expires_in", 86400),
        }
        return token_data["access_token"]

    async def _fetch_token(self, client_id: str, client_secret: str, audience: str) -> dict:
        """Call Auth0 token endpoint for M2M credentials."""
        if not self.domain:
            # Demo mode — return a mock token
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

    async def get_user_info(self, access_token: str) -> dict:
        """Fetch user profile from Auth0 /userinfo endpoint."""
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{self.base_url}/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            resp.raise_for_status()
            return resp.json()

    async def verify_token_scopes(self, token: str, required_scopes: list[str]) -> bool:
        """Check whether a token contains all required scopes."""
        try:
            from jose import jwt
            payload = jwt.get_unverified_claims(token)
            token_scopes = payload.get("scope", "").split()
            return all(s in token_scopes for s in required_scopes)
        except Exception:
            return False

    def get_management_api_url(self) -> str:
        return f"{self.base_url}/api/v2"

    async def list_m2m_applications(self, mgmt_token: str) -> list:
        """List all M2M applications (for Agent Roster display)."""
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{self.get_management_api_url()}/clients",
                headers={"Authorization": f"Bearer {mgmt_token}"},
                params={"app_type": "non_interactive"},
            )
            if resp.status_code != 200:
                return []
            return resp.json()


# Singleton
auth0_service = Auth0Service()