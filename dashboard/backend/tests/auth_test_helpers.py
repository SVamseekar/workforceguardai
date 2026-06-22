from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from auth import db, sessions
from auth.repository import AuthRepository


def authed_client(app, role: str = "admin") -> TestClient:
    async def _seed():
        pool = await db.get_pool()
        await db.run_migrations(pool)
        repo = AuthRepository(pool)
        email = f"test-{uuid.uuid4()}@example.com"
        user = await repo.find_or_create_user(email, "Test User")
        tenant = await repo.create_tenant_with_admin(
            name="Test Tenant", slug=f"test-{uuid.uuid4()}", user_id=user.id
        )
        if role != "admin":
            async with pool.acquire() as conn:
                await conn.execute(
                    "update memberships set role = $1 where user_id = $2 and tenant_id = $3",
                    role,
                    user.id,
                    tenant.id,
                )
        session_id = str(uuid.uuid4())
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        async with pool.acquire() as conn:
            await conn.execute(
                "insert into sessions (id, user_id, tenant_id, expires_at) values ($1, $2, $3, $4)",
                session_id,
                user.id,
                tenant.id,
                expires_at,
            )
        return session_id, expires_at, tenant.id

    session_id, expires_at, tenant_id = asyncio.run(_seed())
    token = sessions.create_session_token(session_id, expires_at)
    client = TestClient(app)
    client.cookies.set(sessions.SESSION_COOKIE_NAME, token)
    # Exposed so tests that trigger tenant-scoped side effects (e.g. the dbt
    # run after a payroll upload) can identify and clean up after themselves.
    client.tenant_id = tenant_id
    return client
