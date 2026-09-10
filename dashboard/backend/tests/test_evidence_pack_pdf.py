from __future__ import annotations

import io
import sys
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from pypdf import PdfReader

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

    def test_review_items_render_real_category_label_and_review_label(self):
        """Regression test for the real review-item shape produced by
        AnalyticsRepository (service.py): items carry a nested
        worker_category.label (not category_label/category_id) and a
        human-readable review_label (not just review_state). The Category
        column must actually show the category label text in the rendered
        PDF, not blank cells."""
        pack = self._sample_pack()
        pack["compliance_review"]["review_items"] = [
            {
                "id": "pay_transparency_category_review:sales_reps",
                "worker_category": {"id": "sales_reps", "label": "Sales Representatives"},
                "review_state": "unresolved_review_item",
                "review_label": "Unresolved review item",
                "priority": "high",
            }
        ]
        pdf_bytes = render_evidence_pack_pdf(pack)
        reader = PdfReader(io.BytesIO(pdf_bytes))
        text = "\n".join(page.extract_text() for page in reader.pages)
        self.assertIn("Sales Representatives", text)
        self.assertIn("Unresolved review item", text)

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
