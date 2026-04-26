from fastapi import APIRouter, Query

from app.services.solana_service import solana_service

router = APIRouter(prefix="/solana", tags=["solana"])


@router.get("/status")
async def solana_status():
    """Check Solana RPC connectivity and cluster metadata."""
    return await solana_service.get_cluster_status()


@router.get("/wallet")
async def solana_wallet(wallet: str | None = Query(default=None)):
    """Inspect the configured wallet or any provided public key."""
    return await solana_service.get_wallet_balance(wallet)


@router.get("/transactions/{signature}")
async def solana_transaction(signature: str):
    """Look up a Solana signature on the configured cluster."""
    return await solana_service.get_signature_status(signature)
