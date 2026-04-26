from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Auth0
    auth0_domain: str = ""
    auth0_audience: str = "https://api.cognitobiz.ai"
    auth0_algorithms: str = "RS256"

    # MongoDB
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "cognitobiz"

    # Snowflake
    snowflake_account: str = ""
    snowflake_user: str = ""
    snowflake_password: str = ""
    snowflake_database: str = "COGNITOBIZ"
    snowflake_warehouse: str = "COMPUTE_WH"
    snowflake_schema: str = "PUBLIC_DATA_FREE"

    # Google AI (Gemma 4)
    google_ai_api_key: str = ""
    gemma_model: str = "gemma-4-31b-it"

    # Solana
    solana_network: str = "devnet"
    solana_rpc_url: str = "https://api.devnet.solana.com"
    solana_owner_keypair: str = ""

    # ElevenLabs
    elevenlabs_api_key: str = ""
    elevenlabs_voice_id: str = "21m00Tcm4TlvDq8ikWAM"

    # Plaid
    plaid_client_id: str = ""
    plaid_secret: str = ""
    plaid_env: str = "sandbox"

    # App
    frontend_url: str = "http://localhost:3000"
    environment: str = "development"

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()

def clear_settings_cache():
    get_settings.cache_clear()