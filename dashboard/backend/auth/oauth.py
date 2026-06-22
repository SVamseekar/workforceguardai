import os
from typing import Tuple

from authlib.integrations.starlette_client import OAuth

_oauth = OAuth()

_oauth.register(
    name="google",
    client_id=os.environ.get("GOOGLE_CLIENT_ID", ""),
    client_secret=os.environ.get("GOOGLE_CLIENT_SECRET", ""),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)

_oauth.register(
    name="microsoft",
    client_id=os.environ.get("MICROSOFT_CLIENT_ID", ""),
    client_secret=os.environ.get("MICROSOFT_CLIENT_SECRET", ""),
    server_metadata_url="https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)


def get_oauth_client(provider: str):
    client = _oauth.create_client(provider)
    if client is None:
        raise ValueError(f"Unknown OAuth provider: {provider}")
    return client


def parse_provider_profile(provider: str, userinfo: dict) -> Tuple[str, str, str]:
    if provider not in ("google", "microsoft"):
        raise ValueError(f"Unknown OAuth provider: {provider}")
    subject = userinfo["sub"]
    email = userinfo["email"]
    display_name = userinfo.get("name", email)
    return subject, email, display_name