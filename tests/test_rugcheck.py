import unittest

from bot.rugcheck import RugCheckClient


class RugCheckTests(unittest.TestCase):
    def test_is_good_handles_text_risk_level(self):
        self.assertTrue(RugCheckClient.is_good({"riskLevel": "Good", "score": 1}))
        self.assertFalse(RugCheckClient.is_good({"riskLevel": "Danger", "score": 1}))
        self.assertFalse(RugCheckClient.is_good({"riskLevel": "warn", "score": 1}))

    def test_is_good_handles_numeric_score_without_risk_level(self):
        # Live reports often have no riskLevel. Raw score is risk points: lower is safer.
        # WIF-like score 1 and BONK-like score 101 are in the Good band (< 1000).
        self.assertTrue(RugCheckClient.is_good({"score": 1}))
        self.assertTrue(RugCheckClient.is_good({"score": 101}))
        self.assertFalse(RugCheckClient.is_good({"score": 1000}))
        self.assertFalse(RugCheckClient.is_good({"score": 20000}))

    def test_is_good_rejects_missing_or_invalid_score(self):
        self.assertFalse(RugCheckClient.is_good({}))
        self.assertFalse(RugCheckClient.is_good({"score": "1"}))
        self.assertFalse(RugCheckClient.is_good({"score": True}))
        self.assertFalse(RugCheckClient.is_good({"rugged": True, "score": 1}))

    def test_only_danger_bundle_or_insider_is_a_bundle(self):
        self.assertEqual(
            RugCheckClient.explicit_bundle(
                {"risks": [{"name": "Bundle detected", "level": "danger"}]}
            ),
            "Bundle detected",
        )
        self.assertIsNone(
            RugCheckClient.explicit_bundle(
                {"risks": [{"name": "Mutable metadata", "level": "warn", "score": 100}]}
            )
        )
        self.assertIsNone(
            RugCheckClient.explicit_bundle(
                {"risks": [{"name": "Top holders high", "level": "warn"}]}
            )
        )
        self.assertFalse(
            RugCheckClient.has_bundle_or_high_concentration(
                {
                    "topHolders": [
                        {"owner": "POOL", "pct": 90},
                        {"owner": "a", "pct": 4},
                        {"owner": "b", "pct": 3},
                    ]
                }
            )
        )


if __name__ == "__main__":
    unittest.main()
