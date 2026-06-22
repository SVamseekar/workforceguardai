import os
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse


def frontend_login_redirect(error_code: str | None = None) -> str:
    base = os.environ.get("FRONTEND_URL", "http://localhost:5173/app")
    if not error_code:
        return base

    parsed = urlparse(base)
    query = parse_qs(parsed.query)
    query["auth_error"] = [error_code]
    return urlunparse(parsed._replace(query=urlencode(query, doseq=True)))