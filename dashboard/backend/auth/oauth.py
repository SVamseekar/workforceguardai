import os
import re
from typing import Any, Dict, Optional, Tuple

from authlib.integrations.starlette_client import OAuth
from authlib.oidc.core import CodeIDToken
from joserfc.errors import InvalidClaimError

_oauth = OAuth()

# Microsoft multi-tenant (/common) discovery advertises issuer
# https://login.microsoftonline.com/{tenantid}/v2.0 as a template. Real ID
# tokens use the concrete tenant GUID (or the MSA consumers tenant). Authlib
# then fails iss validation with InvalidClaimError unless we relax it.
_MS_ISS_RE = re.compile(
    r"^https://login\.microsoftonline\.com/[0-9a-fA-F-]+/v2\.0$"
)

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
    server_metadata_url=(
        "https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration"
    ),
    client_kwargs={"scope": "openid email profile"},
)


class MicrosoftCodeIDToken(CodeIDToken):
    """Accept any Microsoft v2 issuer GUID under login.microsoftonline.com."""

    def validate_iss(self) -> None:
        iss = self.get("iss")
        if not isinstance(iss, str) or not _MS_ISS_RE.match(iss):
            raise InvalidClaimError("iss")


def get_oauth_client(provider: str):
    client = _oauth.create_client(provider)
    if client is None:
        raise ValueError(f"Unknown OAuth provider: {provider}")
    return client


def authorize_access_token_kwargs(provider: str) -> Dict[str, Any]:
    """Extra kwargs for client.authorize_access_token(request, **kwargs)."""
    if provider != "microsoft":
        return {}
    # claims_options must be non-None so Authlib does not pin iss to the
    # discovery template {tenantid}. Essential iss is still enforced by
    # MicrosoftCodeIDToken.validate_iss.
    return {
        "claims_cls": MicrosoftCodeIDToken,
        "claims_options": {"iss": {"essential": True}},
    }


def oauth_auto_provision_enabled() -> bool:
    return os.environ.get("OAUTH_AUTO_PROVISION", "1").strip().lower() in ("1", "true", "yes")


def parse_provider_profile(provider: str, userinfo: dict) -> Tuple[str, str, str]:
    if provider not in ("google", "microsoft"):
        raise ValueError(f"Unknown OAuth provider: {provider}")
    subject = userinfo["sub"]
    email = (
        userinfo.get("email")
        or userinfo.get("preferred_username")
        or userinfo.get("upn")
    )
    if not email:
        raise ValueError(f"OAuth provider {provider} did not return an email address")
    display_name = userinfo.get("name", email)
    return subject, email, display_name


def is_valid_microsoft_issuer(iss: Optional[str]) -> bool:
    return isinstance(iss, str) and bool(_MS_ISS_RE.match(iss))
