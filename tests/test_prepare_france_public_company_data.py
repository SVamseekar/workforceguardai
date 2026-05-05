from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

import pandas as pd


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"

if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from prepare_france_public_company_data import (  # noqa: E402
    detect_column_mapping,
    extract_france_public_company_data,
    find_company_matches,
    normalize_company_name,
    normalize_header,
    select_best_rows,
)


class PrepareFrancePublicCompanyDataTests(unittest.TestCase):
    def test_normalize_helpers_strip_accents_and_symbols(self):
        self.assertEqual(normalize_header("Raison sociale"), "raison_sociale")
        self.assertEqual(normalize_header("Écart de rémunération (%)"), "ecart_de_remuneration")
        self.assertEqual(normalize_company_name("Électricité de France SA"), "ELECTRICITE DE FRANCE SA")

    def test_detect_column_mapping_prefers_specific_france_headers(self):
        frame = pd.DataFrame(
            columns=[
                "SIREN",
                "Raison sociale",
                "Année",
                "Index",
                "Indicateur 1 Ecart de rémunération",
                "Pourcentage Ecart de rémunération",
                "Indicateur 3 Promotions",
                "Indicateur 4 Retour congé maternité",
                "Indicateur 5 Top 10",
                "Tranche effectifs",
            ]
        )

        mapping, unmatched = detect_column_mapping(frame)

        self.assertEqual(mapping["employer_name"], "Raison sociale")
        self.assertEqual(mapping["employer_id"], "SIREN")
        self.assertEqual(mapping["reporting_year"], "Année")
        self.assertEqual(mapping["overall_score"], "Index")
        self.assertEqual(mapping["pay_gap_indicator_score"], "Indicateur 1 Ecart de rémunération")
        self.assertEqual(mapping["pay_gap_percent"], "Pourcentage Ecart de rémunération")
        self.assertEqual(mapping["effectif"], "Tranche effectifs")
        self.assertFalse(unmatched)

    def test_find_company_matches_deduplicates_same_row_across_multiple_terms(self):
        frame = pd.DataFrame(
            [
                {"Raison sociale": "Électricité de France SA", "SIREN": "552081317"},
                {"Raison sociale": "TOTALENERGIES SE", "SIREN": "542051180"},
            ]
        )
        mapping, _ = detect_column_mapping(frame)

        matches = find_company_matches(frame, mapping)

        self.assertEqual(len(matches), 2)
        edf_match = matches.loc[matches["benchmark_key"] == "edf"].iloc[0]
        self.assertIn("EDF", edf_match["matched_search_terms"])
        self.assertIn("Electricite de France", edf_match["matched_search_terms"])

    def test_select_best_rows_prefers_parent_record_per_benchmark_key(self):
        matches = pd.DataFrame(
            [
                {
                    "Raison sociale": "TOTALENERGIES MARKETING FRANCE",
                    "SIREN": "111111111",
                    "Année": "2025",
                    "Index": "95",
                    "Indicateur 1 Ecart de rémunération": "39",
                    "Indicateur 3 Promotions": "15",
                    "Indicateur 4 Retour congé maternité": "15",
                    "Indicateur 5 Top 10": "10",
                    "Tranche effectifs": "250 à 999",
                    "benchmark_key": "totalenergies",
                    "matched_search_terms": "TOTALENERGIES|TotalEnergies",
                },
                {
                    "Raison sociale": "TOTALENERGIES SE",
                    "SIREN": "542051180",
                    "Année": "2025",
                    "Index": "93",
                    "Indicateur 1 Ecart de rémunération": "38",
                    "Indicateur 3 Promotions": "15",
                    "Indicateur 4 Retour congé maternité": "15",
                    "Indicateur 5 Top 10": "10",
                    "Tranche effectifs": "1000 et plus",
                    "benchmark_key": "totalenergies",
                    "matched_search_terms": "TOTALENERGIES|TotalEnergies",
                },
                {
                    "Raison sociale": "EDF Renouvelables",
                    "SIREN": "222222222",
                    "Année": "2025",
                    "Index": "98",
                    "Indicateur 1 Ecart de rémunération": "40",
                    "Indicateur 3 Promotions": "15",
                    "Indicateur 4 Retour congé maternité": "15",
                    "Indicateur 5 Top 10": "10",
                    "Tranche effectifs": "250 à 999",
                    "benchmark_key": "edf",
                    "matched_search_terms": "EDF",
                },
                {
                    "Raison sociale": "EDF SA",
                    "SIREN": "552081317",
                    "Année": "2025",
                    "Index": "96",
                    "Indicateur 1 Ecart de rémunération": "40",
                    "Indicateur 3 Promotions": "15",
                    "Indicateur 4 Retour congé maternité": "15",
                    "Indicateur 5 Top 10": "10",
                    "Tranche effectifs": "1000 et plus",
                    "benchmark_key": "edf",
                    "matched_search_terms": "EDF",
                },
            ]
        )
        mapping, _ = detect_column_mapping(matches.drop(columns=["benchmark_key", "matched_search_terms"]))

        selected = select_best_rows(matches, mapping)

        self.assertEqual(len(selected), 2)
        totalenergies = selected.loc[selected["benchmark_key"] == "totalenergies"].iloc[0]
        edf = selected.loc[selected["benchmark_key"] == "edf"].iloc[0]
        self.assertEqual(totalenergies["Raison sociale"], "TOTALENERGIES SE")
        self.assertEqual(edf["Raison sociale"], "EDF SA")

    def test_extract_france_public_company_data_handles_title_row_and_writes_outputs(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            workbook_path = temp_path / "france_index_raw.xlsx"
            meta_dir = temp_path / "meta"
            normalized_path = temp_path / "france_public_company_benchmark.csv"

            data_frame = pd.DataFrame(
                [
                    {
                        "SIREN": "542051180",
                        "Raison sociale": "TOTALENERGIES SE",
                        "Année": "2025",
                        "Index": "93",
                        "Indicateur 1 Ecart de rémunération": "38",
                        "Pourcentage Ecart de rémunération": "2.1",
                        "Indicateur 3 Promotions": "15",
                        "Indicateur 4 Retour congé maternité": "15",
                        "Indicateur 5 Top 10": "10",
                        "Tranche effectifs": "1000 et plus",
                    },
                    {
                        "SIREN": "552081317",
                        "Raison sociale": "Électricité de France SA",
                        "Année": "2025",
                        "Index": "96",
                        "Indicateur 1 Ecart de rémunération": "40",
                        "Pourcentage Ecart de rémunération": "0.0",
                        "Indicateur 3 Promotions": "15",
                        "Indicateur 4 Retour congé maternité": "15",
                        "Indicateur 5 Top 10": "10",
                        "Tranche effectifs": "1000 et plus",
                    },
                ]
            )

            with pd.ExcelWriter(workbook_path, engine="openpyxl") as writer:
                pd.DataFrame([["Index Egapro France 2026"]]).to_excel(
                    writer,
                    sheet_name="Notes",
                    index=False,
                    header=False,
                )
                pd.DataFrame([["Export officiel Egapro 2026"]]).to_excel(
                    writer,
                    sheet_name="Data",
                    index=False,
                    header=False,
                )
                data_frame.to_excel(writer, sheet_name="Data", startrow=1, index=False)

            result = extract_france_public_company_data(
                source_url="https://example.com/france.xlsx",
                raw_file=workbook_path,
                headers_json=meta_dir / "france_sheet_headers.json",
                matches_csv=meta_dir / "france_company_matches.csv",
                candidates_csv=meta_dir / "france_benchmark_candidates.csv",
                selected_csv=meta_dir / "france_selected_benchmarks.csv",
                normalized_csv=normalized_path,
                audit_json=meta_dir / "france_extraction_audit.json",
                source_published_at="2026-04-13",
                download=False,
            )

            self.assertEqual(result["chosen_sheet"], "Data")
            self.assertEqual(result["header_row"], 1)
            self.assertEqual(len(result["selected"]), 2)
            self.assertEqual(len(result["normalized"]), 2)
            self.assertTrue((meta_dir / "france_sheet_headers.json").exists())
            self.assertTrue(normalized_path.exists())

            audit_payload = json.loads((meta_dir / "france_extraction_audit.json").read_text(encoding="utf-8"))
            self.assertEqual(audit_payload["num_selected_benchmarks"], 2)


if __name__ == "__main__":
    unittest.main()
