"""RugCheck.xyz client."""
from __future__ import annotations

import asyncio
from typing import Any

import aiohttp
from loguru import logger


# Raw RugCheck score is a sum of risk points. Higher is worse.
# Good band is under 1,000; 1,000–5,000 is a warning; above that is danger.
# Live reports often omit riskLevel entirely (seen on WIF score 1, BONK score 101).
GOOD_SCORE_BELOW = 1000


class RugCheckClient:
    def __init__(self, base_url: str = "https://api.rugcheck.xyz"):
        self.base_url = base_url.rstrip("/")
        self._session: aiohttp.ClientSession | None = None

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=25),
                headers={"Accept": "application/json"},
            )
        return self._session

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()

    async def get_report(self, mint: str) -> dict[str, Any] | None:
        session = await self._get_session()
        url = f"{self.base_url}/v1/tokens/{mint}/report"
        for attempt in range(3):
            try:
                async with session.get(url) as resp:
                    if resp.status == 404:
                        return None
                    if resp.status == 429:
                        await asyncio.sleep(2 ** attempt)
                        continue
                    if resp.status >= 400:
                        logger.warning(f"RugCheck {resp.status} for {mint}")
                        return None
                    return await resp.json()
            except Exception as e:
                logger.error(f"RugCheck error for {mint}: {e}")
                await asyncio.sleep(1)
        return None

    async def get_summary(self, mint: str) -> dict[str, Any] | None:
        session = await self._get_session()
        url = f"{self.base_url}/v1/tokens/{mint}/report/summary"
        try:
            async with session.get(url) as resp:
                if resp.status != 200:
                    return None
                return await resp.json()
        except Exception as e:
            logger.error(f"RugCheck summary error: {e}")
            return None

    @staticmethod
    def is_good(report: dict) -> bool:
        """True when the report is in RugCheck's Good band.

        Text ``riskLevel`` wins when it is present. Otherwise the raw ``score``
        is used: it is a sum of risk points, so a low score is safer. A missing
        or non-numeric score fails closed. ``rugged`` never passes.
        """
        if not isinstance(report, dict) or report.get("rugged") is True:
            return False
        level = report.get("riskLevel")
        if isinstance(level, str) and level.strip():
            return level.strip().lower() == "good"
        score = report.get("score")
        # bool is an int subclass; True must not count as a score of 1.
        if isinstance(score, bool) or not isinstance(score, (int, float)):
            return False
        return score < GOOD_SCORE_BELOW

    @staticmethod
    def explicit_bundle(report: dict) -> str | None:
        """Danger-level bundle or insider flag, if any.

        Warn-level notes (mutable metadata, "top holders", "creator balance")
        are common on tradable tokens and are not a permanent blacklist.
        """
        if not isinstance(report, dict):
            return None
        for risk in report.get("risks") or []:
            if not isinstance(risk, dict):
                continue
            name = str(risk.get("name") or "")
            level = str(risk.get("level") or "").lower()
            if level not in ("danger", "critical"):
                continue
            lower = name.lower()
            if "bundle" in lower or "insider" in lower:
                return name or "Bundle or insider risk"
        return None

    @staticmethod
    def has_bundle_or_high_concentration(report: dict) -> bool:
        """True only for an explicit danger-level bundle or insider flag.

        Holder concentration is judged separately, after pools and lockers are
        removed, and it does not blacklist the mint.
        """
        return RugCheckClient.explicit_bundle(report) is not None
