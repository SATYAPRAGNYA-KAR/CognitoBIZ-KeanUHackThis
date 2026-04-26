"""
Snowflake Service — Peer benchmarking and analytics queries.
Uses Snowflake Marketplace data (Cybersyn + BLS + SEC).
"""

import asyncio
from typing import Optional
from functools import lru_cache
from app.config.settings import get_settings

settings = get_settings()

try:
    import snowflake.connector
    SNOWFLAKE_AVAILABLE = True
except ImportError:
    SNOWFLAKE_AVAILABLE = False
    print("⚠️  Snowflake connector not available — using mock data")


# Mock benchmark data for demo when Snowflake is unavailable
MOCK_BENCHMARKS = {
    "SaaS": {
        "seed": {
            "Infrastructure": {"avg": 5100, "p25": 2800, "p75": 8200},
            "Payroll": {"avg": 45000, "p25": 28000, "p75": 72000},
            "Marketing": {"avg": 3400, "p25": 1200, "p75": 8000},
            "Legal": {"avg": 380, "p25": 200, "p75": 800},
            "Software Subscriptions": {"avg": 2200, "p25": 800, "p75": 4500},
        },
        "pre-seed": {
            "Infrastructure": {"avg": 1800, "p25": 600, "p75": 3200},
            "Payroll": {"avg": 18000, "p25": 8000, "p75": 32000},
            "Marketing": {"avg": 1200, "p25": 400, "p75": 3000},
            "Legal": {"avg": 250, "p25": 100, "p75": 600},
            "Software Subscriptions": {"avg": 900, "p25": 300, "p75": 2000},
        },
    },
    "E-commerce": {
        "seed": {
            "Infrastructure": {"avg": 3200, "p25": 1500, "p75": 6000},
            "Payroll": {"avg": 35000, "p25": 20000, "p75": 55000},
            "Marketing": {"avg": 12000, "p25": 5000, "p75": 25000},
        },
    },
}

MOCK_SALARY_BENCHMARKS = {
    "frontend_developer": {"hourly_low": 65, "hourly_avg": 95, "hourly_high": 140},
    "backend_developer": {"hourly_low": 70, "hourly_avg": 105, "hourly_high": 155},
    "fullstack_developer": {"hourly_low": 70, "hourly_avg": 100, "hourly_high": 145},
    "product_manager": {"hourly_low": 75, "hourly_avg": 110, "hourly_high": 160},
    "designer": {"hourly_low": 55, "hourly_avg": 80, "hourly_high": 125},
    "data_scientist": {"hourly_low": 80, "hourly_avg": 115, "hourly_high": 170},
}


class SnowflakeService:
    def __init__(self):
        self._conn = None

    def _get_connection(self):
        if not SNOWFLAKE_AVAILABLE:
            return None
        if self._conn is None or self._conn.is_closed():
            try:
                self._conn = snowflake.connector.connect(
                    account=settings.snowflake_account,
                    user=settings.snowflake_user,
                    password=settings.snowflake_password,
                    database=settings.snowflake_database,
                    warehouse=settings.snowflake_warehouse,
                    schema=settings.snowflake_schema,
                )
                print("✅ Connected to Snowflake")
            except Exception as e:
                print(f"⚠️  Snowflake connection failed: {e}")
                return None
        return self._conn

    def _query(self, sql: str, params: tuple = ()) -> list[dict]:
        """Execute a Snowflake query and return results as list of dicts."""
        conn = self._get_connection()
        if conn is None:
            return []
        try:
            cursor = conn.cursor(snowflake.connector.DictCursor)
            cursor.execute(sql, params)
            return cursor.fetchall()
        except Exception as e:
            print(f"Snowflake query error: {e}")
            return []

    async def get_peer_benchmarks(
        self, industry: str, stage: str
    ) -> dict:
        """
        Query Cybersyn + SEC data for peer company benchmarks.
        Falls back to mock data if Snowflake unavailable.
        """
        # Try real Snowflake first
        if SNOWFLAKE_AVAILABLE:
            sql = """
            SELECT
                att.variable_name                                        AS category,
                AVG(ts.value)                                            AS peer_avg,
                PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ts.value)  AS p25,
                PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ts.value)  AS p75,
                COUNT(*)                                                 AS sample_size
            FROM SNOWFLAKE_PUBLIC_DATA.PUBLIC_DATA_FREE.FINANCIAL_ECONOMIC_INDICATORS_TIMESERIES AS ts
            JOIN SNOWFLAKE_PUBLIC_DATA.PUBLIC_DATA_FREE.FINANCIAL_ECONOMIC_INDICATORS_ATTRIBUTES AS att
                ON ts.variable = att.variable
            WHERE ts.date >= DATEADD('month', -6, CURRENT_DATE)
            GROUP BY att.variable_name
            ORDER BY peer_avg DESC
            LIMIT 20
            """
            rows = self._query(sql)
            print(f"Snowflake returned {len(rows)} rows")
            if rows:
                return {
                    row["CATEGORY"]: {
                        "avg": float(row["PEER_AVG"]),
                        "p25": float(row["P25"]),
                        "p75": float(row["P75"]),
                        "sample_size": int(row["SAMPLE_SIZE"]),
                    }
                    for row in rows
                }
            
        print("⚠️ Falling back to mock data")

        # Fallback to mock data
        industry_data = MOCK_BENCHMARKS.get(industry, MOCK_BENCHMARKS["SaaS"])
        return industry_data.get(stage, industry_data.get("seed", {}))

    async def get_salary_benchmarks(
        self, role_keyword: str
    ) -> dict:
        """
        Query BLS salary data for market rate validation.
        Used when generating WorkContracts.
        """
        if SNOWFLAKE_AVAILABLE:
            sql = """
            SELECT
                att.industry       AS role,
                MIN(ts.value)      AS hourly_low,
                AVG(ts.value)      AS hourly_avg,
                MAX(ts.value)      AS hourly_high
            FROM SNOWFLAKE_PUBLIC_DATA.PUBLIC_DATA_FREE.BUREAU_OF_LABOR_STATISTICS_EMPLOYMENT_TIMESERIES AS ts
            JOIN SNOWFLAKE_PUBLIC_DATA.PUBLIC_DATA_FREE.BUREAU_OF_LABOR_STATISTICS_EMPLOYMENT_ATTRIBUTES AS att
                ON ts.variable = att.variable
            WHERE att.measure ILIKE '%wage%'
            AND ts.date >= DATEADD('month', -3, CURRENT_DATE)
            GROUP BY att.industry
            LIMIT 20
            """
            rows = self._query(sql)
            if rows:
                row = rows[0]
                return {
                    "hourly_low": float(row.get("HOURLY_LOW", 0)),
                    "hourly_avg": float(row.get("HOURLY_AVG", 0)),
                    "hourly_high": float(row.get("HOURLY_HIGH", 0)),
                }

        # Fuzzy match against mock data
        for role, data in MOCK_SALARY_BENCHMARKS.items():
            if any(word in role for word in role_keyword.lower().split()):
                return data
        return MOCK_SALARY_BENCHMARKS.get("backend_developer", {})

    async def upsert_company_metrics(
        self, company_id: str, metrics: dict
    ) -> bool:
        """
        ETL: Write company aggregated metrics to Snowflake for benchmarking.
        """
        if not SNOWFLAKE_AVAILABLE:
            return True  # Silent success in demo mode

        sql = """
        MERGE INTO COGNITOBIZ.PUBLIC.COMPANY_METRICS AS target
        USING (SELECT %s as company_id, %s as category, %s as monthly_spend) AS source
        ON target.company_id = source.company_id AND target.category = source.category
        WHEN MATCHED THEN UPDATE SET monthly_spend = source.monthly_spend
        WHEN NOT MATCHED THEN INSERT (company_id, category, monthly_spend) 
            VALUES (source.company_id, source.category, source.monthly_spend)
        """
        for category, amount in metrics.items():
            self._query(sql, (company_id, category, amount))
        return True


# Singleton
snowflake_service = SnowflakeService()