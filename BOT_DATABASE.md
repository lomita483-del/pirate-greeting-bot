# AHOY bot database setup

The website and the bot now share **your own Supabase project**. The schema is already
created there (all 20 AHOY tables: servers, settings, members, warnings, moderation logs,
tickets, XP, economy, reminders, custom commands, automod, logging, welcome, roles,
platform admins/users/notifications). Nothing more to run in the SQL editor.

If you ever need to recreate it in a fresh project, run
[`bot/sql/schema.sql`](bot/sql/schema.sql) in **SQL Editor → New query**.

## Credentials for the bot

In your Supabase project: **Settings → API**

| Value | Env var |
| --- | --- |
| Project URL | `SUPABASE_URL` |
| `service_role` secret key | `SUPABASE_SERVICE_ROLE_KEY` |

Keep the service role key private — it bypasses RLS and only the bot process should see it.

## Run the bot

```bash
export DISCORD_TOKEN=your-bot-token
export SUPABASE_URL=https://xxxxxxxx.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
export OWNER_DISCORD_IDS=your-discord-user-id
python -m bot.main
```

Or set the same four variables in Railway / Render / Fly / Docker. Full hosting steps are in
[`RUNNING.md`](RUNNING.md).

Startup should log:

```
AHOY is online as AHOY#1234 (guilds: N)
```

## Notes

- Because both sides point at the same project, anything the bot writes (XP, tickets,
  warnings, economy) shows up in the dashboard immediately, and dashboard settings changes
  take effect in the bot within its cache window.
- Every table has row-level security on with no public policies: nothing is readable from a
  browser. Only the bot and the website's server code (service role) can touch the data.
- The bot degrades gracefully: without `SUPABASE_URL` it still connects to Discord and
  answers `/ahoy`, but persistent features are disabled.
- Enable **Server Members** and **Message Content** privileged intents in the Discord
  Developer Portal, or message-based features stay silent.
