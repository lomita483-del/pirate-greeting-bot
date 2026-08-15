# AHOY bot database setup (Option 1: the bot gets its own Supabase project)

The website's managed database credentials are locked, so the Python bot uses its own
Supabase project. Takes about 5 minutes.

## 1. Create the project

1. Go to https://supabase.com → **New project**.
2. Pick any name (e.g. `ahoy-bot`), set a database password, choose a region near your host.
3. Wait for provisioning to finish.

## 2. Create the tables

1. In your new project open **SQL Editor → New query**.
2. Copy the entire contents of [`bot/sql/schema.sql`](bot/sql/schema.sql) and paste it in.
3. Click **Run**. It creates all 20 AHOY tables (servers, settings, members, warnings,
   moderation logs, tickets, XP, economy, reminders, custom commands, automod, logging,
   welcome, roles, platform admins/users/notifications) with RLS enabled and
   `service_role` access.

Re-running the script is safe — every statement uses `if not exists` / `drop policy if exists`.

## 3. Grab the credentials

In the project: **Settings → API**

| Value | Env var |
| --- | --- |
| Project URL | `SUPABASE_URL` |
| `service_role` secret key | `SUPABASE_SERVICE_ROLE_KEY` |

Keep the service role key private — it bypasses RLS. Only the bot process ever sees it.

## 4. Run the bot

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

## 5. Notes

- **Two databases is normal.** The website dashboard reads the Lovable-managed database;
  the bot reads its own. If you want the dashboard to control the *same* rows the bot uses,
  tell me and I'll switch the website's server functions over to this Supabase project too
  (its URL + service key get stored as website secrets).
- The bot degrades gracefully: if `SUPABASE_URL` is missing it still connects to Discord and
  answers `/ahoy`, but persistent features (XP, economy, tickets, warnings) are disabled.
- Enable **Server Members** and **Message Content** privileged intents in the Discord
  Developer Portal, or message-based features stay silent.
