"""Telegram switch-on rules and environment-variable secrets."""
import unittest

from bot.config import apply_env_overrides
from bot.telegram_trader import TelegramTrader


class TelegramEnabled(unittest.TestCase):
    def test_enabled_once_token_and_chat_id_are_set(self):
        tg = TelegramTrader({"bot_token": "123:abc", "chat_id": "42"}, dry_run=False)
        self.assertTrue(tg.enabled)

    def test_stays_off_without_credentials(self):
        self.assertFalse(TelegramTrader({"bot_token": "", "chat_id": ""}).enabled)
        self.assertFalse(TelegramTrader({"bot_token": "123:abc", "chat_id": ""}).enabled)
        self.assertFalse(TelegramTrader({"bot_token": "", "chat_id": "42"}).enabled)

    def test_explicit_false_mutes(self):
        tg = TelegramTrader({"enabled": False, "bot_token": "123:abc", "chat_id": "42"})
        self.assertFalse(tg.enabled)


class EnvOverrides(unittest.TestCase):
    def test_env_fills_empty_config(self):
        cfg = {"telegram": {"bot_token": "", "chat_id": ""}}
        apply_env_overrides(cfg, {"TELEGRAM_BOT_TOKEN": " 123:abc ", "TELEGRAM_CHAT_ID": "42"})
        self.assertEqual(cfg["telegram"], {"bot_token": "123:abc", "chat_id": "42"})

    def test_env_beats_file_value(self):
        cfg = {"telegram": {"bot_token": "file-token", "chat_id": "1"}}
        apply_env_overrides(cfg, {"TELEGRAM_BOT_TOKEN": "env-token"})
        self.assertEqual(cfg["telegram"]["bot_token"], "env-token")
        self.assertEqual(cfg["telegram"]["chat_id"], "1")

    def test_blank_env_leaves_config_alone(self):
        cfg = {"telegram": {"bot_token": "file-token", "chat_id": "1"}}
        apply_env_overrides(cfg, {"TELEGRAM_BOT_TOKEN": "  ", "TELEGRAM_CHAT_ID": ""})
        self.assertEqual(cfg["telegram"], {"bot_token": "file-token", "chat_id": "1"})

    def test_missing_telegram_section_is_created(self):
        cfg = {}
        apply_env_overrides(cfg, {"TELEGRAM_BOT_TOKEN": "t"})
        self.assertEqual(cfg["telegram"]["bot_token"], "t")


if __name__ == "__main__":
    unittest.main()
