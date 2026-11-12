"""Load and validate configuration."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Mapping

import yaml
from loguru import logger


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG = ROOT / "config.yaml"

# Environment variables that override config.yaml, so secrets never have to be
# written into a file that can be committed.
ENV_OVERRIDES = {
    "TELEGRAM_BOT_TOKEN": ("telegram", "bot_token"),
    "TELEGRAM_CHAT_ID": ("telegram", "chat_id"),
}


def apply_env_overrides(cfg: dict[str, Any], env: Mapping[str, str] | None = None) -> dict[str, Any]:
    """Copy non-empty ENV_OVERRIDES values into ``cfg`` in place and return it."""
    env = os.environ if env is None else env
    for var, (section, key) in ENV_OVERRIDES.items():
        value = (env.get(var) or "").strip()
        if value:
            if not isinstance(cfg.get(section), dict):
                cfg[section] = {}
            cfg[section][key] = value
    return cfg


def load_config(path: Path | str = DEFAULT_CONFIG) -> dict[str, Any]:
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Config not found: {path}")
    with open(path, encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    apply_env_overrides(cfg)
    logger.info(f"Loaded config from {path}")
    return cfg


def load_blacklist(path: Path | str) -> set[str]:
    path = Path(path)
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("[]", encoding="utf-8")
        return set()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return set(str(x).lower() for x in data)
    except Exception as e:
        logger.warning(f"Failed to load blacklist {path}: {e}")
        return set()


def save_blacklist(path: Path | str, items: set[str]) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(sorted(items), indent=2), encoding="utf-8")
    logger.debug(f"Saved blacklist ({len(items)} items) → {path}")
