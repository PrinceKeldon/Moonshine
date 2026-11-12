import asyncio
from pathlib import Path

from telegram import Bot

from bot.config import load_config


def load_telegram_config() -> dict:
    # load_config applies TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID overrides.
    config = load_config(Path(__file__).with_name("config.yaml"))
    telegram = config["telegram"]
    token = str(telegram.get("bot_token", ""))
    chat_id = str(telegram.get("chat_id", ""))
    if not token or token == "YOUR_TELEGRAM_BOT_TOKEN":
        raise ValueError("Set TELEGRAM_BOT_TOKEN (or telegram.bot_token in config.yaml) first")
    if not chat_id or chat_id == "YOUR_CHAT_ID":
        raise ValueError("Set TELEGRAM_CHAT_ID (or telegram.chat_id in config.yaml) first")
    return {"token": token, "chat_id": chat_id}


async def main() -> None:
    settings = load_telegram_config()
    try:
        async with Bot(token=settings["token"]) as bot:
            me = await bot.get_me()
            print("Bot connected successfully as:", me.username)

            await bot.send_message(
                chat_id=settings["chat_id"],
                text="✅ Test message from Moonshine bot",
            )
            print("Message sent successfully!")
    except Exception as error:
        message = str(error).replace(settings["token"], "[REDACTED BOT TOKEN]")
        print("ERROR:", type(error).__name__, message)


if __name__ == "__main__":
    asyncio.run(main())
