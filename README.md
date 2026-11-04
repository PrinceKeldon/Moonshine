# DexScreener Analysis & Trading Bot

Professional-grade Solana memecoin scanner that:

1. Discovers new / promoted tokens via DexScreener token profiles
2. Applies configurable liquidity / volume / age / market-cap filters
3. Detects suspected **fake volume** (heuristic approximating wash-trading patterns)
4. Checks every token on **RugCheck.xyz** — only proceeds with `riskLevel == "Good"`
5. Detects **bundles / high concentration** and auto-blacklists them
6. Classifies **rugs** and **pumps**, persists everything to SQLite + JSONL
7. Sends Telegram notifications and (optionally) buy commands for **Bonkbot** / similar TG trading bots
8. Maintains persistent **coin blacklist** and **dev blacklist**

## Quick start

```bash
cd moonshine-bot
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Edit config
# Fill telegram.bot_token, telegram.chat_id
# Set runtime.dry_run: false when you are ready to send real buys

python -m bot.main
```

## Configuration (`config.yaml`)

| Section | Purpose |
|---------|--------|
| `dexscreener` | Base URL, poll interval, rate-limit delay |
| `rugcheck` | Only-Good filter, bundle rejection |
| `fake_volume` | Heuristic thresholds (no public Pocket Universe volume API exists) |
| `filters` | Min liquidity / volume, max age, market-cap bounds |
| `blacklists` | Paths + auto-add rules |
| `analysis` | Rug / pump price-change thresholds |
| `telegram` | Bot token, chat ID, buy command template, notification toggles |
| `runtime` | `dry_run` (recommended true at first), max pairs per cycle |

### Telegram + Bonkbot

1. Create a bot with @BotFather → copy the token into `telegram.bot_token`
2. Start a chat with your bot (or add it to a group) and get the `chat_id`
3. In the same chat (or a group where both bots are present) you can also talk to @bonkbot_bot
4. The default `buy_command_template: "{mint}"` simply pastes the contract address — Bonkbot usually auto-detects it and offers buy buttons.
5. Change the template if you prefer explicit commands, e.g. `"/buy {mint} 0.1"`

**Always keep `runtime.dry_run: true` until you have verified notifications and blacklisting.**

## Data outputs

- `data/tokens.db` — SQLite (tokens + events)
- `data/analysis.jsonl` — one JSON object per analysed token
- `data/coin_blacklist.json` / `data/dev_blacklist.json` — persistent blacklists
- `logs/bot.log` — rotating log

## Important notes

- DexScreener has **no official “new pairs” firehose**. This bot uses the latest token-profiles feed + pair enrichment, which is the practical public approach. For true on-chain sniping you would add a Helius / Yellowstone gRPC listener.
- “Pocket Universe API for fake volume” is not a public endpoint. The bot implements transparent heuristics that catch common wash-trading signatures. You can tighten/loosen them in config.
- RugCheck free tier has rate limits; the client already backs off on 429.
- Trading is **at your own risk**. This software is for research and automation assistance only.

## Project layout

```
moonshine-bot/
├── bot/
│   ├── main.py              # orchestrator
│   ├── dexscreener.py       # API client
│   ├── rugcheck.py          # safety checks
│   ├── analysis.py          # filters + classification
│   ├── risk.py              # paper book, stops, sizing
│   ├── ledger.py            # decisions + counterfactuals
│   ├── desk.py              # pipeline ↔ risk engine
│   ├── storage.py           # SQLite + JSONL
│   ├── telegram_trader.py   # notifications + buy commands
│   └── config.py
├── data/                    # blacklists, db, jsonl
├── logs/
├── config.yaml
├── requirements.txt
└── README.md
```

## Extending

- Add a real on-chain new-pair listener (Helius webhooks / Geyser)
- Enrich with Birdeye / Bubblemaps holder data
- Implement sell logic / trailing stops via Bonkbot limit-order commands
- Multi-chain support (change `dexscreener.chain` and filters)

---

Built as a complete, production-oriented single codebase matching the original requirements.

## Risk engine, ledger and desk

Every buy now goes through `bot/risk.py` and every decision is written to `bot/ledger.py`
(`data/ledger.db`). The pipeline above still decides *candidates*; the desk (`bot/desk.py`)
decides whether a candidate becomes a position.

- **Rules** (`risk:` in `config.yaml`): hard stop, trail that arms only after a gain, no adding
  to a position, revenge lock after a losing exit, no open-name cap, per-name sizing cap, daily loss halt.
- **Position agent** (`agent:` in `config.yaml`): after each risk mark, it can flatten on low or
  sharply declining liquidity, protect large gains from give-back, force a scale-out after a
  strong peak, and reduce exposure near the time stop when PnL is still below the soft target.
- **Paper book**: positions persist in `data/book.json`. Paper fills include slippage plus pool
  impact (`2 x ticket / liquidity`), so shallow pools cost what they would really cost. A position
  whose price disappears is written off at zero after `stale_exit_s`.
- **Exits**: marked every cycle before discovery. With `sell_command_template` empty the bot
  sends a "SELL NOW" message and you sell by hand; set a template only after testing it.
- **Open loop**: in live mode the buy message is sent to the trading bot but no fill comes back.
  Treat the book as a model of your bankroll, not proof of what executed.
- **Counterfactuals**: each rejected or skipped token is re-priced after 1h and 24h. Query which
  gates earn their keep with `Ledger("data/ledger.db").gate_report()`: a gate whose rejected names
  average a positive move is killing winners.
- **Older-token scan**: in addition to the latest profiles, the bot checks DexScreener's latest and
  top boosted Solana tokens, plus any mints listed under `older_tokens.mints`. Anything at least
  `min_age_minutes` old (the same window as `filters.max_age_minutes`, so there is no dead zone)
  must show either the configured 1h breakout or a tracked liquidity spike. Those names skip the
  new-pair age cap and the new-pair market-cap cap (`older_tokens.max_market_cap_usd: 0` means no
  cap). A breakout that also prints as a pump is still scored and offered to the desk; only rugs
  are hard-blocked. Liquidity history is stored in `data/tokens.db`, so the spike detector needs a
  full lookback window after first tracking a mint. DexScreener does not expose a complete
  market-wide historical-token feed; boosts and the optional mint watchlist define this scan's
  candidate universe. Pair creation time is used as the available age proxy.
- **Blacklists**: `auto_add_fake_volume` and `auto_add_bundles` default off, so a heuristic skip
  does not permanently remove a mint. `auto_add_rugs` still does. Creator wallets in
  `data/dev_blacklist.json` are skipped after RugCheck names them.
- **RugCheck**: raw `score` is risk points (lower is safer). With no `riskLevel`, Good is score
  under 1,000. Holder concentration is measured after dropping AMM/locker accounts and one
  dominant pool-like holder, and a breach skips the pass instead of blacklisting.
- **Tests**: `python -m unittest discover -s tests -t .` (needs `loguru`, `aiohttp`, `aiosqlite`, `PyYAML`).
