"""
ETL Job — Syncs aggregated company metrics from MongoDB to Snowflake.
Runs nightly (or on-demand). Enables peer benchmarking queries.

Run standalone:  python -m app.jobs.etl_job
"""

import asyncio
from datetime import datetime, timedelta
from app.config.mongodb import connect_db, close_db, get_db
from app.services.snowflake_service import snowflake_service


async def sync_company_to_snowflake(company_id: str) -> dict:
    """Aggregate a company's monthly spend by category and push to Snowflake."""
    db = get_db()
    thirty_ago = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
    today = datetime.utcnow().strftime("%Y-%m-%d")

    # Aggregate spend by category for the current month
    pipeline = [
        {
            "$match": {
                "company_id": company_id,
                "date": {"$gte": thirty_ago, "$lte": today},
                "amount": {"$lt": 0},
            }
        },
        {
            "$group": {
                "_id": "$category",
                "monthly_spend": {"$sum": {"$abs": "$amount"}},
            }
        },
    ]
    categories = await db.transactions.aggregate(pipeline).to_list(50)
    metrics = {cat["_id"]: round(cat["monthly_spend"], 2) for cat in categories if cat["_id"]}

    if not metrics:
        return {"company_id": company_id, "categories_synced": 0, "skipped": True}

    # Push to Snowflake
    success = await snowflake_service.upsert_company_metrics(company_id, metrics)

    result = {
        "company_id": company_id,
        "categories_synced": len(metrics),
        "period": f"{thirty_ago} to {today}",
        "snowflake_success": success,
        "synced_at": datetime.utcnow().isoformat(),
    }

    # Store ETL run record in MongoDB for audit trail
    await db.etl_runs.insert_one({
        **result,
        "metrics_snapshot": metrics,
    })

    print(f"✅ ETL synced {len(metrics)} categories for company {company_id}")
    return result


async def run_full_etl():
    """Run ETL for all companies."""
    await connect_db()
    db = get_db()

    companies = await db.companies.find({}).to_list(500)
    results = []
    for company in companies:
        company_id = str(company["_id"])
        try:
            result = await sync_company_to_snowflake(company_id)
            results.append(result)
        except Exception as e:
            print(f"❌ ETL failed for company {company_id}: {e}")
            results.append({"company_id": company_id, "error": str(e)})

    await close_db()
    print(f"✅ ETL complete: {len(results)} companies processed")
    return results


if __name__ == "__main__":
    asyncio.run(run_full_etl())