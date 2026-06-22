from typing import List, Optional

import asyncpg

from .models import Membership, Tenant, User


class AuthRepository:
    def __init__(self, pool: asyncpg.Pool):
        self._pool = pool

    async def find_or_create_user(self, email: str, display_name: str) -> User:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                "select id, email, display_name from users where email = $1", email
            )
            if row is None:
                row = await conn.fetchrow(
                    """
                    insert into users (email, display_name)
                    values ($1, $2)
                    returning id, email, display_name
                    """,
                    email,
                    display_name,
                )
            return User(id=str(row["id"]), email=row["email"], display_name=row["display_name"])

    async def link_oauth_identity(self, user_id: str, provider: str, provider_subject: str) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                insert into oauth_identities (user_id, provider, provider_subject)
                values ($1, $2, $3)
                on conflict (provider, provider_subject) do nothing
                """,
                user_id,
                provider,
                provider_subject,
            )

    async def find_user_by_oauth(self, provider: str, provider_subject: str) -> Optional[User]:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                select u.id, u.email, u.display_name
                from users u
                join oauth_identities oi on oi.user_id = u.id
                where oi.provider = $1 and oi.provider_subject = $2
                """,
                provider,
                provider_subject,
            )
            if row is None:
                return None
            return User(id=str(row["id"]), email=row["email"], display_name=row["display_name"])

    async def create_tenant_with_admin(self, name: str, slug: str, user_id: str) -> Tenant:
        async with self._pool.acquire() as conn:
            async with conn.transaction():
                row = await conn.fetchrow(
                    "insert into tenants (name, slug) values ($1, $2) returning id, name, slug",
                    name,
                    slug,
                )
                await conn.execute(
                    "insert into memberships (user_id, tenant_id, role) values ($1, $2, 'admin')",
                    user_id,
                    row["id"],
                )
                return Tenant(id=str(row["id"]), name=row["name"], slug=row["slug"])

    async def get_tenant_by_slug(self, slug: str) -> Optional[Tenant]:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow("select id, name, slug from tenants where slug = $1", slug)
            if row is None:
                return None
            return Tenant(id=str(row["id"]), name=row["name"], slug=row["slug"])

    async def get_membership(self, user_id: str, tenant_id: str) -> Optional[Membership]:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                "select user_id, tenant_id, role from memberships where user_id = $1 and tenant_id = $2",
                user_id,
                tenant_id,
            )
            if row is None:
                return None
            return Membership(
                user_id=str(row["user_id"]), tenant_id=str(row["tenant_id"]), role=row["role"]
            )

    async def list_memberships_for_user(self, user_id: str) -> List[Membership]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                "select user_id, tenant_id, role from memberships where user_id = $1", user_id
            )
            return [
                Membership(user_id=str(r["user_id"]), tenant_id=str(r["tenant_id"]), role=r["role"])
                for r in rows
            ]