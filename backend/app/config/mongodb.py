from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config.settings import get_settings

settings = get_settings()

_client: AsyncIOMotorClient | None = None


async def connect_db():
    global _client
    _client = AsyncIOMotorClient(
        settings.mongodb_uri,
        serverSelectionTimeoutMS=3000,
        connectTimeoutMS=3000,
    )
    try:
        await _client.admin.command("ping")
        print("Connected to MongoDB Atlas")
    except Exception as e:
        print(f"MongoDB unavailable at startup - continuing in degraded mode: {e}")


async def close_db():
    global _client
    if _client:
        _client.close()
        print("MongoDB connection closed")


def get_db() -> AsyncIOMotorDatabase:
    if _client is None:
        raise RuntimeError("Database not connected. Call connect_db() first.")
    return _client[settings.mongodb_db_name]
