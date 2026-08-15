# Running the AHOY bot

The website is hosted for you. The Python bot is a long-running process, so it
must run somewhere you control (your machine, a VPS, Railway, Fly, Render…).

## 1. Discord Developer Portal

- **Bot → Privileged Gateway Intents**: enable **Server Members Intent** and
  **Message Content Intent**. Without them the bot connects but ignores
  messages (no XP, AutoMod, custom commands, transcripts).
- **OAuth2 → Redirects**: add
  `https://pirate-greeting-bot.lovable.app/api/public/auth/discord/callback`

## 2. Environment variables

The bot uses its own Supabase project — see [`BOT_DATABASE.md`](BOT_DATABASE.md) for the
5-minute setup (create project → run `bot/sql/schema.sql` → copy URL + service role key).

```
DISCORD_TOKEN=...                 # bot token
SUPABASE_URL=...                  # your bot Supabase project URL
SUPABASE_SERVICE_ROLE_KEY=...     # that project's service_role key
OWNER_DISCORD_IDS=...             # your Discord user ID
LOG_LEVEL=INFO
PORT=8080                         # optional: enables /health
```


## 3. Run locally

```bash
pip install -r requirements.txt
python -m bot.main
```

Expected log lines:

```
Loaded extension bot.commands.general
Registered N slash commands with Discord.
AHOY is online as AHOY#1234 (…) across N server(s).
```

## 4. Run with Docker

```bash
docker build -t ahoy-bot .
docker run --env-file .env ahoy-bot
```

## 5. Deploy as a worker

- **Railway / Heroku-style**: the `Procfile` declares `worker: python -m bot.main`.
- **Render**: use a *Background Worker* (start command `python -m bot.main`), or a
  *Web Service* with `PORT` set so the `/health` endpoint answers.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| No response to any slash command | Process not running, or commands not synced yet (global sync can take up to an hour; re-invite the bot with `applications.commands`) |
| Connects but no XP / AutoMod | Message Content Intent disabled |
| "Storage unavailable" replies | `SUPABASE_URL` / key missing or wrong |
| Commands refuse with "restricted" | Your account is banned or feature-limited in the Owner Console |

## Reaction roles & giveaways

New slash commands:

- `/reactionrole create` → posts a picker message, then `/reactionrole add message_id: emoji: role:` for each option (`/reactionrole remove`, `/reactionrole list`).
- `/giveaway start prize: duration: winners:` → posts a 🎉 entry embed; AHOY draws winners automatically when the timer ends (`/giveaway end`, `/giveaway reroll`).

Level rewards configured under **Dashboard → Roles → Level rewards** are now granted
automatically on level-up.

Intents: reactions are part of Discord's default (non-privileged) intents, so nothing new
needs enabling in the Developer Portal — the existing **Server Members** and **Message
Content** privileged intents are still required. AHOY needs **Manage Roles** in the server,
with its own role positioned above any role it hands out.
