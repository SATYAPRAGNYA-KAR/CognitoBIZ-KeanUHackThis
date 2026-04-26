"""
Snowflake configuration helper.
The actual query logic lives in app/services/snowflake_service.py.
This module exposes a single get_snowflake_connection() for direct use
when needed outside the service class.
"""

from app.config.settings import get_settings

settings = get_settings()


def get_snowflake_connection():
    """
    Return a synchronous Snowflake connector connection.
    Returns None if Snowflake is not configured or the SDK is not installed.
    """
    try:
        import snowflake.connector
        if not all([settings.snowflake_account, settings.snowflake_user, settings.snowflake_password]):
            return None
        conn = snowflake.connector.connect(
            account=settings.snowflake_account,
            user=settings.snowflake_user,
            password=settings.snowflake_password,
            database=settings.snowflake_database,
            warehouse=settings.snowflake_warehouse,
            schema=settings.snowflake_schema,
        )
        return conn
    except ImportError:
        return None
    except Exception as e:
        print(f"⚠️  Snowflake connection failed: {e}")
        return None