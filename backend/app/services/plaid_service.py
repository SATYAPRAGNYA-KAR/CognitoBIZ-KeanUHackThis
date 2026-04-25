"""
Plaid Service — Bank account connection and transaction sync via Plaid Sandbox.
Handles Link token creation, public token exchange, and transaction fetching.
"""

import httpx
from datetime import datetime, timedelta
from typing import Optional
from app.config.settings import get_settings

settings = get_settings()

PLAID_BASE_URLS = {
    "sandbox": "https://sandbox.plaid.com",
    "development": "https://development.plaid.com",
    "production": "https://production.plaid.com",
}

# Category mapping from Plaid categories to CognitoBIZ categories
CATEGORY_MAP = {
    "Service": "Software Subscriptions",
    "Software": "Software Subscriptions",
    "Cloud Services": "Infrastructure",
    "Payroll": "Payroll",
    "Transfer": "Transfer",
    "Payment": "Contractor Payments",
    "Marketing": "Marketing",
    "Legal": "Legal",
    "Office": "Office",
    "Travel": "Travel",
    "Food and Drink": "Meals & Entertainment",
    "Shops": "Office",
}


class PlaidService:
    def __init__(self):
        self.client_id = settings.plaid_client_id
        self.secret = settings.plaid_secret
        self.env = settings.plaid_env
        self.base_url = PLAID_BASE_URLS.get(self.env, PLAID_BASE_URLS["sandbox"])
        self._headers = {"Content-Type": "application/json"}

    def _is_configured(self) -> bool:
        return bool(self.client_id and self.secret)

    def _auth_body(self) -> dict:
        return {"client_id": self.client_id, "secret": self.secret}

    async def create_link_token(self, user_id: str) -> dict:
        """Create a Plaid Link token to open the Link modal in the frontend."""
        if not self._is_configured():
            return {"link_token": "mock_link_token", "expiration": "", "request_id": "mock"}

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{self.base_url}/link/token/create",
                headers=self._headers,
                json={
                    **self._auth_body(),
                    "user": {"client_user_id": user_id},
                    "client_name": "CognitoBIZ",
                    "products": ["transactions"],
                    "country_codes": ["US"],
                    "language": "en",
                },
            )
            resp.raise_for_status()
            return resp.json()

    async def exchange_public_token(self, public_token: str) -> dict:
        """Exchange the public token returned by Plaid Link for an access token."""
        if not self._is_configured():
            return {"access_token": "mock_access_token", "item_id": "mock_item_id"}

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{self.base_url}/item/public_token/exchange",
                headers=self._headers,
                json={**self._auth_body(), "public_token": public_token},
            )
            resp.raise_for_status()
            return resp.json()

    async def get_accounts(self, access_token: str) -> list:
        """Fetch all accounts linked to the access token."""
        if not self._is_configured():
            return [
                {"account_id": "mock_checking", "name": "Business Checking", "type": "depository",
                 "balances": {"current": 185420.0, "available": 183200.0}, "mask": "4242"},
            ]

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{self.base_url}/accounts/get",
                headers=self._headers,
                json={**self._auth_body(), "access_token": access_token},
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("accounts", [])

    async def get_transactions(
        self,
        access_token: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> list:
        """Fetch transactions from Plaid and normalize to CognitoBIZ format."""
        if not start_date:
            start_date = (datetime.utcnow() - timedelta(days=90)).strftime("%Y-%m-%d")
        if not end_date:
            end_date = datetime.utcnow().strftime("%Y-%m-%d")

        if not self._is_configured():
            return []  # Demo data is seeded via seed_demo_data endpoint instead

        all_txns = []
        offset = 0
        while True:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(
                    f"{self.base_url}/transactions/get",
                    headers=self._headers,
                    json={
                        **self._auth_body(),
                        "access_token": access_token,
                        "start_date": start_date,
                        "end_date": end_date,
                        "options": {"count": 500, "offset": offset},
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                txns = data.get("transactions", [])
                all_txns.extend(txns)
                if len(all_txns) >= data.get("total_transactions", 0):
                    break
                offset += len(txns)

        return [self._normalize_transaction(t) for t in all_txns]

    def _normalize_transaction(self, plaid_txn: dict) -> dict:
        """Convert a Plaid transaction to CognitoBIZ transaction schema."""
        plaid_categories = plaid_txn.get("category", [])
        primary_cat = plaid_categories[0] if plaid_categories else "Miscellaneous"
        mapped_cat = CATEGORY_MAP.get(primary_cat, primary_cat)

        # Plaid amounts: positive = debit (expense), negative = credit (income)
        # CognitoBIZ convention: negative = expense, positive = income — invert
        amount = -plaid_txn.get("amount", 0)

        return {
            "plaid_transaction_id": plaid_txn.get("transaction_id"),
            "amount": round(amount, 2),
            "category": mapped_cat,
            "subcategory": plaid_categories[1] if len(plaid_categories) > 1 else None,
            "vendor": plaid_txn.get("merchant_name") or plaid_txn.get("name", "Unknown"),
            "date": plaid_txn.get("date"),
            "source": "plaid",
            "status": "active",
            "flagged": False,
            "is_recurring": plaid_txn.get("recurring", False),
        }

    async def get_balance(self, access_token: str) -> float:
        """Get current cash balance from primary checking account."""
        accounts = await self.get_accounts(access_token)
        for acc in accounts:
            if acc.get("type") == "depository":
                return acc.get("balances", {}).get("current", 0.0)
        return 0.0


# Singleton
plaid_service = PlaidService()