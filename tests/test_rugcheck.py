import unittest

from bot.rugcheck import RugCheckClient


class RugCheckTests(unittest.TestCase):
    def test_is_good_handles_text_risk_level(self):
        self.assertTrue(RugCheckClient.is_good({"riskLevel": "Good", "score": 1}))
        self.assertFalse(RugCheckClient.is_good({"riskLevel": "Danger", "score": 100}))

    def test_is_good_handles_numeric_score_without_risk_level(self):
        self.assertTrue(RugCheckClient.is_good({"score": 100}))
        self.assertFalse(RugCheckClient.is_good({"score": 1}))

    def test_is_good_rejects_missing_or_invalid_score(self):
        self.assertFalse(RugCheckClient.is_good({}))
        self.assertFalse(RugCheckClient.is_good({"score": "100"}))


if __name__ == "__main__":
    unittest.main()
