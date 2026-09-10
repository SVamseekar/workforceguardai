from __future__ import annotations

import sys
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from evidence_pack_pdf import render_evidence_pack_pdf


class EvidencePackPdfTests(unittest.TestCase):
    def _sample_pack(self):
        return {
            "generated_at": "2026-09-10T00:00:00+00:00",
            "pack_type": "workforceguard_compliance_evidence_pack",
            "pack_version": "phase-4-v2",
            "chain_tip_hash": "GENESIS",
            "filters": {"country": "DE", "geography": "DE", "sector": "ALL", "period": "latest"},
            "summary": {"headline": "Test headline.", "summary": "Test summary."},
            "metrics": [
                {"id": "employment_rate", "title": "Employment rate", "value": 74.2, "unit": "%",
                 "provenance": {"source_id": "eurostat_lfs"}},
            ],
            "semantic_metrics": [
                {"id": "hiring_pressure_index", "title": "Hiring pressure index", "value": 55.0, "unit": "score"},
            ],
            "compliance_review": {
                "status": "in_review",
                "review_items": [],
                "governance_integrity": {"verified": True, "event_count": 1, "latest_hash": "abc123"},
                "export_contract": {"contains_person_level_data": False},
            },
            "governance": {"integrity": {"verified": True, "event_count": 1, "latest_hash": "abc123"}},
            "integrity": {
                "pack_hash": "deadbeef",
                "signature": "c2lnbmF0dXJl",
                "signature_algorithm": "ed25519",
                "signing_key_id": "abcd1234",
                "signed_at": "2026-09-10T00:00:00+00:00",
            },
        }

    def test_renders_non_empty_pdf(self):
        pdf_bytes = render_evidence_pack_pdf(self._sample_pack())
        self.assertGreater(len(pdf_bytes), 0)
        self.assertTrue(pdf_bytes.startswith(b"%PDF-"))

    def test_renders_pdf_with_none_values(self):
        """Regression test: pack with explicit None values should render without crashing."""
        pack = self._sample_pack()
        pack["governance"] = None
        pack["compliance_review"] = None
        pack["metrics"] = None
        pack["semantic_metrics"] = None
        pdf_bytes = render_evidence_pack_pdf(pack)
        self.assertGreater(len(pdf_bytes), 0)
        self.assertTrue(pdf_bytes.startswith(b"%PDF-"))


if __name__ == "__main__":
    unittest.main()
