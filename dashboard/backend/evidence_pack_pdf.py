"""Renders a compliance evidence pack (as returned by
AnalyticsRepository.build_evidence_pack) to a PDF suitable for legal/works
council handoff. No person-level payroll data is included — this module
only formats fields already present in the pack, which itself carries the
'contains_person_level_data: False' contract."""

from __future__ import annotations

import io
from typing import Any, Dict, List

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

_STYLES = getSampleStyleSheet()
_MONO = ParagraphStyle("mono", parent=_STYLES["Code"], fontSize=8, leading=10)


def _metrics_table(rows: List[Dict[str, Any]], value_key: str = "value") -> Table:
    header = ["Metric", "Value", "Unit", "Source"]
    data = [header]
    for row in rows:
        source = (row.get("provenance") or {}).get("source_id", "")
        value = row.get(value_key)
        data.append([
            str(row.get("title") or row.get("id") or ""),
            "Unavailable" if value is None else str(value),
            str(row.get("unit") or ""),
            str(source),
        ])
    table = Table(data, colWidths=[70 * mm, 30 * mm, 25 * mm, 35 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2a37")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#c9d2db")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f4f6f8")]),
            ]
        )
    )
    return table


def render_evidence_pack_pdf(pack: Dict[str, Any]) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        title="WorkforceGuard Compliance Evidence Pack",
    )
    story: List[Any] = []

    story.append(Paragraph("WorkforceGuard Compliance Evidence Pack", _STYLES["Title"]))
    filters = pack.get("filters") or {}
    story.append(
        Paragraph(
            f"Generated {pack.get('generated_at', '')} &middot; "
            f"Geography: {filters.get('geography', '')} &middot; "
            f"Sector: {filters.get('sector', '')} &middot; "
            f"Period: {filters.get('period', '')}",
            _STYLES["Normal"],
        )
    )
    story.append(Spacer(1, 6 * mm))

    summary = pack.get("summary") or {}
    story.append(Paragraph("Summary", _STYLES["Heading2"]))
    story.append(Paragraph(summary.get("headline", ""), _STYLES["Normal"]))
    story.append(Paragraph(summary.get("summary", ""), _STYLES["Normal"]))
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph("Observed metrics", _STYLES["Heading2"]))
    story.append(_metrics_table(pack.get("metrics") or []))
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph("Modeled semantic metrics", _STYLES["Heading2"]))
    story.append(_metrics_table(pack.get("semantic_metrics") or []))
    story.append(Spacer(1, 6 * mm))

    compliance_review = pack.get("compliance_review") or {}
    story.append(Paragraph("Pay-transparency review", _STYLES["Heading2"]))
    story.append(Paragraph(f"Status: {compliance_review.get('status', 'unavailable')}", _STYLES["Normal"]))
    review_items = compliance_review.get("review_items") or []
    if review_items:
        item_rows = [["Category", "Review state"]] + [
            [str(item.get("category_label") or item.get("category_id") or ""), str(item.get("review_state") or "")]
            for item in review_items
        ]
        item_table = Table(item_rows, colWidths=[100 * mm, 60 * mm])
        item_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2a37")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#c9d2db")),
                ]
            )
        )
        story.append(item_table)
    else:
        story.append(Paragraph("No open review items.", _STYLES["Normal"]))
    story.append(Spacer(1, 6 * mm))

    governance_integrity = (pack.get("governance") or {}).get("integrity", {})
    story.append(Paragraph("Governance decision log", _STYLES["Heading2"]))
    story.append(
        Paragraph(
            f"Chain verified: {governance_integrity.get('verified')} &middot; "
            f"Events: {governance_integrity.get('event_count')} &middot; "
            f"Latest hash: {governance_integrity.get('latest_hash')}",
            _STYLES["Normal"],
        )
    )
    story.append(Spacer(1, 6 * mm))

    integrity = pack.get("integrity") or {}
    story.append(Paragraph("Pack integrity", _STYLES["Heading2"]))
    story.append(
        Paragraph(
            "This pack is cryptographically signed. To verify independently: fetch the current signing "
            "public key from GET /api/evidence-pack/public-key, then verify the signature below against "
            "the canonical JSON form of this pack with the 'integrity' field removed.",
            _STYLES["Normal"],
        )
    )
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph(f"pack_hash: {integrity.get('pack_hash', '')}", _MONO))
    story.append(Paragraph(f"chain_tip_hash: {pack.get('chain_tip_hash', '')}", _MONO))
    story.append(Paragraph(f"signing_key_id: {integrity.get('signing_key_id', '')}", _MONO))
    story.append(Paragraph(f"signature_algorithm: {integrity.get('signature_algorithm', '')}", _MONO))
    story.append(Paragraph(f"signed_at: {integrity.get('signed_at', '')}", _MONO))
    story.append(Paragraph(f"signature: {integrity.get('signature', '')}", _MONO))

    doc.build(story)
    return buffer.getvalue()
