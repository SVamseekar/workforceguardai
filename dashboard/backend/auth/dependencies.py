from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request

from . import db, sessions
from .repository import AuthRepository

_ROLE_RANK = {"member": 0, "admin": 1}


@dataclass(frozen=True)
class AuthContext:
    user_id: str
    tenant_id: str
    role: str


async def require_session(request: Request) -> AuthContext:
    token = request.cookies.get(sessions.SESSION_COOKIE_NAME)
    if token is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_id = sessions.verify_session_token(token)
    if session_id is None:
        raise HTTPException(status_code=401, detail="Session expired or invalid")

    pool = await db.get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            select s.user_id, s.tenant_id, m.role
            from sessions s
            join memberships m on m.user_id = s.user_id and m.tenant_id = s.tenant_id
            where s.id = $1 and s.expires_at > now()
            """,
            session_id,
        )

    if row is None:
        raise HTTPException(status_code=401, detail="Session expired or invalid")

    return AuthContext(user_id=str(row["user_id"]), tenant_id=str(row["tenant_id"]), role=row["role"])


def require_role(min_role: str):
    async def dependency(ctx: AuthContext = Depends(require_session)) -> AuthContext:
        if _ROLE_RANK[ctx.role] < _ROLE_RANK[min_role]:
            raise HTTPException(status_code=403, detail=f"Requires {min_role} role")
        return ctx

    return dependency