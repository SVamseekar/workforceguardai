#!/usr/bin/env python3
"""Create an admin session for the demo tenant used in Playwright captures."""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "dashboard" / "backend"
DEFAULT_TENANT_ID = "a0000000-0000-4000-8000-000000000001"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from auth import db, sessions  # noqa: E402
from auth.repository import AuthRepository  # noqa: E402


async def seed_capture_session(tenant_id: str) -> dict[str, str]:
    pool = await db.get_pool()
    await db.run_migrations(pool)
    repo = AuthRepository(pool)

    async with pool.acquire() as conn:
        tenant_row = await conn.fetchrow(
            "select id, name, slug from tenants where id = $1::uuid",
            tenant_id,
        )
        if tenant_row is None:
            user = await repo.find_or_create_user(
                "capture@workforceguard.local",
                "Capture Admin",
            )
            await conn.execute(
                """
                insert into tenants (id, name, slug)
                values ($1::uuid, $2, $3)
                """,
                tenant_id,
                "Meridian Demo",
                "meridian-demo",
            )
            await conn.execute(
                """
                insert into memberships (user_id, tenant_id, role)
                values ($1::uuid, $2::uuid, 'admin')
                on conflict do nothing
                """,
                user.id,
                tenant_id,
            )
            user_id = user.id
        else:
            membership = await conn.fetchrow(
                """
                select u.id
                from memberships m
                join users u on u.id = m.user_id
                where m.tenant_id = $1::uuid and m.role = 'admin'
                limit 1
                """,
                tenant_id,
            )
            if membership is None:
                user = await repo.find_or_create_user(
                    "capture@workforceguard.local",
                    "Capture Admin",
                )
                await conn.execute(
                    """
                    insert into memberships (user_id, tenant_id, role)
                    values ($1::uuid, $2::uuid, 'admin')
                    """,
                    user.id,
                    tenant_id,
                )
                user_id = user.id
            else:
                user_id = str(membership["id"])

    session_id = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(hours=2)
    async with pool.acquire() as conn:
        await conn.execute(
            """
            insert into sessions (id, user_id, tenant_id, expires_at)
            values ($1::uuid, $2::uuid, $3::uuid, $4)
            """,
            session_id,
            user_id,
            tenant_id,
            expires_at,
        )

    token = sessions.create_session_token(session_id, expires_at)
    return {
        "cookie_name": sessions.SESSION_COOKIE_NAME,
        "cookie_value": token,
        "tenant_id": tenant_id,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed a capture session for Playwright")
    parser.add_argument(
        "--tenant-id",
        default=os.environ.get("WG_CAPTURE_TENANT_ID", DEFAULT_TENANT_ID),
    )
    args = parser.parse_args()

    if "DATABASE_URL" not in os.environ:
        raise SystemExit("DATABASE_URL must be set")

    if "SESSION_SECRET" not in os.environ:
        os.environ["SESSION_SECRET"] = "capture-session-secret-not-for-production"

    payload = asyncio.run(seed_capture_session(args.tenant_id))
    print(json.dumps(payload))


if __name__ == "__main__":
    main()
