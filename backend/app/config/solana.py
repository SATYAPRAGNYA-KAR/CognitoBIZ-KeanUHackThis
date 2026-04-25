"""
Solana configuration helper.
The actual Solana logic lives in app/services/solana_service.py.
This module provides network constants and a connectivity check.
"""

from app.config.settings import get_settings

settings = get_settings()

SOLANA_NETWORKS = {
    "devnet": "https://api.devnet.solana.com",
    "testnet": "https://api.testnet.solana.com",
    "mainnet-beta": "https://api.mainnet-beta.solana.com",
}

SOLANA_EXPLORER_BASE = "https://explorer.solana.com"
MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"


def get_rpc_url() -> str:
    """Return the configured Solana RPC URL."""
    return settings.solana_rpc_url or SOLANA_NETWORKS.get(settings.solana_network, SOLANA_NETWORKS["devnet"])


def get_explorer_tx_url(tx_hash: str, network: str = "devnet") -> str:
    return f"{SOLANA_EXPLORER_BASE}/tx/{tx_hash}?cluster={network}"


def get_explorer_account_url(address: str, network: str = "devnet") -> str:
    return f"{SOLANA_EXPLORER_BASE}/address/{address}?cluster={network}"


async def check_rpc_connectivity() -> bool:
    """Ping the Solana RPC to verify connectivity."""
    try:
        import httpx
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                get_rpc_url(),
                json={"jsonrpc": "2.0", "id": 1, "method": "getHealth"},
            )
            return resp.status_code == 200
    except Exception:
        return False