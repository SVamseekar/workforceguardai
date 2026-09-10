from __future__ import annotations

import os
import sys
from pathlib import Path

os.environ.setdefault("SESSION_SECRET", "test-secret-not-for-production-use-only")

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import unittest

import evidence_signing


class EvidenceSigningTests(unittest.TestCase):
    def _key_pair(self):
        seed_b64 = evidence_signing.generate_signing_key_b64()
        os.environ[evidence_signing.SIGNING_KEY_ENV_VAR] = seed_b64
        return evidence_signing.load_signing_key()

    def test_round_trip_sign_and_verify(self):
        key = self._key_pair()
        pack = {"pack_type": "demo", "metrics": [{"id": "employment_rate", "value": 74.2}]}
        integrity = evidence_signing.sign_pack(pack, key)
        signed_pack = {**pack, "integrity": integrity}

        self.assertTrue(
            evidence_signing.verify_pack(signed_pack, evidence_signing.public_key_pem(key))
        )
        self.assertEqual(integrity["signature_algorithm"], "ed25519")
        self.assertEqual(integrity["signing_key_id"], evidence_signing.key_id(key))

    def test_verify_fails_when_pack_body_is_tampered(self):
        key = self._key_pair()
        pack = {"pack_type": "demo", "metrics": [{"id": "employment_rate", "value": 74.2}]}
        integrity = evidence_signing.sign_pack(pack, key)
        tampered_pack = {**pack, "metrics": [{"id": "employment_rate", "value": 99.9}], "integrity": integrity}

        self.assertFalse(
            evidence_signing.verify_pack(tampered_pack, evidence_signing.public_key_pem(key))
        )

    def test_verify_fails_with_wrong_public_key(self):
        key_a = self._key_pair()
        pack = {"pack_type": "demo"}
        integrity = evidence_signing.sign_pack(pack, key_a)
        signed_pack = {**pack, "integrity": integrity}

        other_seed_b64 = evidence_signing.generate_signing_key_b64()
        os.environ[evidence_signing.SIGNING_KEY_ENV_VAR] = other_seed_b64
        key_b = evidence_signing.load_signing_key()

        self.assertFalse(evidence_signing.verify_pack(signed_pack, evidence_signing.public_key_pem(key_b)))

    def test_load_signing_key_round_trips_through_env_var(self):
        key = self._key_pair()
        reloaded = evidence_signing.load_signing_key()
        self.assertEqual(evidence_signing.public_key_pem(key), evidence_signing.public_key_pem(reloaded))


if __name__ == "__main__":
    unittest.main()
