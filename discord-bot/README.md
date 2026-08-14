# Discord Bot

A simple Python Discord bot using `discord.py` that responds to the `!ahoy` command with "Ahoy, matey! 🏴‍☠️".

## Setup

1. Install dependencies:

   ```bash
   cd discord-bot
   pip install -r requirements.txt
   ```

2. Set your Discord bot token:

   - Copy `.env.example` to `.env` and replace the placeholder with your bot token.
   - Or export the token as an environment variable:

     ```bash
     export DISCORD_TOKEN=your_bot_token_here
     ```

3. Run the bot:

   ```bash
   python bot.py
   ```

## Usage

In a Discord server where the bot is present, type:

```text
!ahoy
```

The bot will reply with:

```text
Ahoy, matey! 🏴‍☠️
```
