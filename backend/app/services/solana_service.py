"""
Solana Service - RPC-backed network access for escrow metadata, audit references,
and wallet inspection on Solana Devnet.
"""

import hashlib
import json
from datetime import datetime
from typing import Any

import httpx

from app.config.settings import get_settings

settings = get_settings()


class SolanaRPCError(RuntimeError):
    pass


class SolanaService:
    def __init__(self):
        self.rpc_url = settings.solana_rpc_url
        self.network = settings.solana_network
        self.owner_public_key = settings.solana_owner_public_key

    def _mock_tx_hash(self, data: str) -> str:
        payload = f"{data}:{datetime.utcnow().isoformat()}"
        return hashlib.sha256(payload.encode()).hexdigest()[:64].upper()

    def _derive_escrow_wallet(self, contract_id: str, company_id: str) -> str:
        seed = hashlib.sha256(f"escrow:{company_id}:{contract_id}".encode()).hexdigest()
        return f"CB{seed[:42].upper()}"

    async def _rpc_request(self, method: str, params: list[Any] | None = None) -> Any:
        body = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params or [],
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(self.rpc_url, json=body)
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise SolanaRPCError(f"RPC request failed: {exc}") from exc

        payload = response.json()
        if payload.get("error"):
            message = payload["error"].get("message", "Unknown Solana RPC error")
            raise SolanaRPCError(message)

        return payload.get("result")

    async def get_cluster_status(self) -> dict[str, Any]:
        try:
            version = await self._rpc_request("getVersion")
            health = await self._rpc_request("getHealth")
            latest_blockhash = await self._rpc_request("getLatestBlockhash", [{"commitment": "confirmed"}])
            return {
                "connected": True,
                "network": self.network,
                "rpc_url": self.rpc_url,
                "health": health,
                "solana_core": version.get("solana-core") if isinstance(version, dict) else None,
                "latest_blockhash": latest_blockhash.get("value", {}).get("blockhash")
                if isinstance(latest_blockhash, dict)
                else None,
                "owner_public_key": self.owner_public_key or None,
            }
        except SolanaRPCError as exc:
            return {
                "connected": False,
                "network": self.network,
                "rpc_url": self.rpc_url,
                "health": "unavailable",
                "error": str(exc),
                "owner_public_key": self.owner_public_key or None,
            }

    async def get_wallet_balance(self, wallet: str | None = None) -> dict[str, Any]:
        target_wallet = wallet or self.owner_public_key
        if not target_wallet:
            return {
                "wallet": None,
                "network": self.network,
                "balance_sol": None,
                "balance_lamports": None,
                "configured": False,
                "error": "No Solana wallet configured. Set SOLANA_OWNER_PUBLIC_KEY.",
            }

        try:
            result = await self._rpc_request(
                "getBalance",
                [target_wallet, {"commitment": "confirmed"}],
            )
            lamports = result.get("value", 0) if isinstance(result, dict) else 0
            return {
                "wallet": target_wallet,
                "network": self.network,
                "balance_lamports": lamports,
                "balance_sol": round(lamports / 1_000_000_000, 9),
                "configured": True,
            }
        except SolanaRPCError as exc:
            return {
                "wallet": target_wallet,
                "network": self.network,
                "balance_sol": None,
                "balance_lamports": None,
                "configured": True,
                "error": str(exc),
            }

    async def get_signature_status(self, signature: str) -> dict[str, Any]:
        try:
            result = await self._rpc_request(
                "getSignatureStatuses",
                [[signature], {"searchTransactionHistory": True}],
            )
            values = result.get("value", []) if isinstance(result, dict) else []
            status = values[0] if values else None
            return {
                "signature": signature,
                "network": self.network,
                "found": bool(status),
                "status": status,
                "explorer_url": self.get_explorer_url(signature),
            }
        except SolanaRPCError as exc:
            return {
                "signature": signature,
                "network": self.network,
                "found": False,
                "error": str(exc),
                "explorer_url": self.get_explorer_url(signature),
            }

    async def initialize_escrow(self, contract_id: str, amount_usd: float, company_id: str) -> dict[str, Any]:
        cluster = await self.get_cluster_status()
        escrow_wallet = self._derive_escrow_wallet(contract_id, company_id)
        tx_hash = self._mock_tx_hash(f"escrow:init:{company_id}:{contract_id}:{amount_usd}")

        return {
            "escrow_wallet": escrow_wallet,
            "tx_hash": tx_hash,
            "network": self.network,
            "explorer_url": self.get_explorer_url(tx_hash),
            "amount_locked": amount_usd,
            "contract_id": contract_id,
            "mode": "simulated_escrow_reference",
            "rpc_connected": cluster.get("connected", False),
        }

    async def release_milestone_payment(
        self,
        contract_id: str,
        milestone_id: int,
        amount_usd: float,
        vendor_wallet: str,
        approved_by: str,
    ) -> dict[str, Any]:
        cluster = await self.get_cluster_status()
        tx_hash = self._mock_tx_hash(
            f"escrow:release:{contract_id}:{milestone_id}:{amount_usd}:{vendor_wallet}:{approved_by}"
        )

        return {
            "tx_hash": tx_hash,
            "network": self.network,
            "explorer_url": self.get_explorer_url(tx_hash),
            "amount_released": amount_usd,
            "contract_id": contract_id,
            "milestone_id": milestone_id,
            "vendor_wallet": vendor_wallet,
            "mode": "simulated_payment_reference",
            "rpc_connected": cluster.get("connected", False),
        }

    async def write_audit_memo(self, action_summary: dict) -> str:
        memo_text = json.dumps(
            {
                "app": "CognitoBIZ",
                "action": action_summary.get("action_type"),
                "actor": action_summary.get("actor"),
                "timestamp": datetime.utcnow().isoformat(),
                "ref": action_summary.get("reference_id"),
            },
            sort_keys=True,
        )
        return self._mock_tx_hash(f"audit:{memo_text}")

    def get_explorer_url(self, tx_hash: str) -> str:
        return f"https://explorer.solana.com/tx/{tx_hash}?cluster={self.network}"


solana_service = SolanaService()
