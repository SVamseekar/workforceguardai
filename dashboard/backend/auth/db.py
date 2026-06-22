import asyncio
import os
from pathlib import Path
import asyncpg

_pool: asyncpg.Pool | None = None
_pool_loop_id: int | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool, _pool_loop_id
    loop_id = id(asyncio.get_running_loop())
    if _pool is not None and _pool_loop_id != loop_id:
        try:
            await _pool.close()
        except Exception:
            pass
        _pool = None
        _pool_loop_id = None
    if _pool is None:
        database_url = os.environ["DATABASE_URL"]
        _pool = await asyncpg.create_pool(database_url, min_size=1, max_size=10)
        _pool_loop_id = loop_id
    return _pool


async def run_migrations(pool: asyncpg.Pool) -> None:
    schema_path = Path(__file__).resolve().parent / "schema.sql"
    sql = schema_path.read_text()
    async with pool.acquire() as conn:
        await conn.execute(sql)