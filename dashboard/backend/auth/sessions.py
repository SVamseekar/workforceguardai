import os
from datetime import datetime, timezone
from typing import Optional

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

SESSION_COOKIE_NAME = "wfg_session"


def session_cookie_secure() -> bool:
    explicit = os.environ.get("SESSION_COOKIE_SECURE", "").strip().lower()
    if explicit in ("1", "true", "yes"):
        return True
    if explicit in ("0", "false", "no"):
        return False
    redirect_base = os.environ.get("OAUTH_REDIRECT_BASE_URL", "")
    return redirect_base.startswith("https://")


def _serializer() -> URLSafeTimedSerializer:
    secret = os.environ["SESSION_SECRET"]
    return URLSafeTimedSerializer(secret, salt="wfg-session")


def create_session_token(session_id: str, expires_at: datetime) -> str:
    max_age = int((expires_at - datetime.now(timezone.utc)).total_seconds())
    return _serializer().dumps({"session_id": session_id, "max_age": max_age})


def verify_session_token(token: str) -> Optional[str]:
    try:
        payload = _serializer().loads(token, max_age=_max_age_from_token(token))
    except (BadSignature, SignatureExpired, ValueError):
        return None
    return payload.get("session_id")


def _max_age_from_token(token: str) -> int:
    try:
        payload = _serializer().loads(token, max_age=None)
    except BadSignature:
        return 0
    return int(payload.get("max_age", 0))
