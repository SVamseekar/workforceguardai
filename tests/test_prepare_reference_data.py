from __future__ import annotations

import sys
import unittest
from pathlib import Path

import pandas as pd


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"

if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from prepare_reference_data import (  # noqa: E402
    prepare_crosswalk,
    prepare_esco_occupations,
    prepare_esco_relations,
    prepare_esco_skills,
)


class PrepareReferenceDataTests(unittest.TestCase):
    def test_prepare_esco_occupations_normalizes_expected_columns(self):
        frame = pd.DataFrame(
            [
                {
                    "conceptUri": "urn:esco:occupation:1",
                    "preferredLabel": "Data Scientist",
                    "description": "Analyzes data",
                    "isco08Code": "2511",
                }
            ]
        )

        prepared = prepare_esco_occupations(frame, "1.2.1")

        self.assertEqual(
            list(prepared.columns),
            ["esco_uri", "preferred_label", "concept_type", "description", "isco08_code", "isco08_label", "version"],
        )
        self.assertEqual(prepared.iloc[0]["esco_uri"], "urn:esco:occupation:1")
        self.assertEqual(prepared.iloc[0]["version"], "1.2.1")

    def test_prepare_esco_skills_and_relations_keep_canonical_keys(self):
        skills = pd.DataFrame(
            [
                {
                    "conceptUri": "urn:esco:skill:1",
                    "preferredLabel": "Python programming",
                    "skillType": "knowledge",
                    "digitalSkillIndicator": "true",
                }
            ]
        )
        relations = pd.DataFrame(
            [
                {
                    "occupationUri": "urn:esco:occupation:1",
                    "skillUri": "urn:esco:skill:1",
                    "relationType": "essential",
                }
            ]
        )

        prepared_skills = prepare_esco_skills(skills, "1.2.1")
        prepared_relations = prepare_esco_relations(relations, "1.2.1")

        self.assertIn("skill_uri", prepared_skills.columns)
        self.assertIn("occupation_uri", prepared_relations.columns)
        self.assertIn("skill_uri", prepared_relations.columns)

    def test_prepare_crosswalk_normalizes_esco_and_nace_join(self):
        frame = pd.DataFrame(
            [
                {
                    "ESCO URI": "urn:esco:occupation:1",
                    "ESCO Label": "Data Scientist",
                    "NACE Rev2 Code": "J62",
                    "NACE Rev2 Label": "Computer programming",
                }
            ]
        )

        prepared = prepare_crosswalk(frame, "2025")

        self.assertEqual(prepared.iloc[0]["esco_uri"], "urn:esco:occupation:1")
        self.assertEqual(prepared.iloc[0]["nace_rev2_code"], "J62")
        self.assertEqual(prepared.iloc[0]["crosswalk_version"], "2025")


if __name__ == "__main__":
    unittest.main()
