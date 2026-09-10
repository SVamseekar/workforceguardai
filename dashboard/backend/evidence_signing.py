"""Ed25519 signing and verification for compliance evidence packs.

The signing key is app-managed (not a qualified electronic signature) and
lives outside DuckDB entirely, in the WORKFORCEGUARD_EVIDENCE_SIGNING_KEY
environment variable — see SECURITY.md for the rotation procedure.
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
from datetime import datetime, timezone
from typing import Any, Dict

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

SIGNING_KEY_ENV_VAR = "WORKFORCEGUARD_EVIDENCE_SIGNING_KEY"


def load_signing_key() -> Ed25519PrivateKey:
    """Reads the signing key from the environment. No fallback: matches the
    SESSION_SECRET convention at main.py:127 — missing this env var must
    crash loudly, not silently generate an ephemeral key."""
    encoded = os.environ[SIGNING_KEY_ENV_VAR]
    seed = base64.b64decode(encoded)
    return Ed25519PrivateKey.from_private_bytes(seed)


def generate_signing_key_b64() -> str:
    """Generates a new base64-encoded Ed25519 private key seed, suitable for
    WORKFORCEGUARD_EVIDENCE_SIGNING_KEY. Used by key-rotation and by tests —
    never called on the request path."""
    key = Ed25519PrivateKey.generate()
    seed = key.private_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PrivateFormat.Raw,
        encryption_algorithm=serialization.NoEncryption(),
    )
    return base64.b64encode(seed).decode("ascii")


def public_key_pem(private_key: Ed25519PrivateKey) -> str:
    pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return pem.decode("ascii")


def key_id(private_key: Ed25519PrivateKey) -> str:
    """Short fingerprint of the public key, safe to publish alongside a
    signature so a verifier can confirm which key rotation era signed it."""
    return hashlib.sha256(public_key_pem(private_key).encode("ascii")).hexdigest()[:8]


def _canonical_bytes(payload: Dict[str, Any]) -> bytes:
    return json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sign_pack(pack: Dict[str, Any], private_key: Ed25519PrivateKey) -> Dict[str, str]:
    """Signs `pack` (which must NOT already contain an 'integrity' key) and
    returns the integrity block to merge in as pack['integrity']."""
    pack_bytes = _canonical_bytes(pack)
    signature = private_key.sign(pack_bytes)
    return {
        "pack_hash": hashlib.sha256(pack_bytes).hexdigest(),
        "signature": base64.b64encode(signature).decode("ascii"),
        "signature_algorithm": "ed25519",
        "signing_key_id": key_id(private_key),
        "signed_at": datetime.now(timezone.utc).isoformat(),
    }


def verify_pack(pack_with_integrity: Dict[str, Any], public_key_pem_str: str) -> bool:
    """Verifies a pack dict that includes its own 'integrity' block, against
    a PEM-encoded Ed25519 public key. Returns False (never raises) for any
    tampering, missing fields, or wrong key — callers should treat False as
    'not verifiable', not distinguish the reason."""
    pack = dict(pack_with_integrity)
    integrity = pack.pop("integrity", None)
    if not isinstance(integrity, dict):
        return False
    if "signature" not in integrity or "pack_hash" not in integrity:
        return False

    pack_bytes = _canonical_bytes(pack)
    if hashlib.sha256(pack_bytes).hexdigest() != integrity["pack_hash"]:
        return False

    try:
        public_key = serialization.load_pem_public_key(public_key_pem_str.encode("ascii"))
        public_key.verify(base64.b64decode(integrity["signature"]), pack_bytes)
    except (InvalidSignature, ValueError, TypeError):
        return False
    return True
