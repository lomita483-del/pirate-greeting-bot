# AHOY: Category bulk actions + Calendar Sync & Discord Event Reminders

Three separate things are being asked for. They are very different in size, so here is how I propose to sequence them — all inside the existing AHOY architecture (same Supabase project, same Discord OAuth, same dashboard design system). Nothing existing gets removed or redesigned.

## Part 1 — Category-level quick actions on the Commands page

On each command category (the accordion groups on `/dashboard/:guildId/commands`), add a bulk-action bar like the reference screenshots:

- Checkbox selection per command + "select all in category"
- "Set channel for all" / "Remove channel for all"
- "Mass edit" — opens the existing command config dialog and applies the chosen roles, blocked roles, required permission, allowed channels, output channel and cooldown to every selected command in one save
- Enable all / disable all for the category
- A live "N commands selected" counter

Backend: one new bulk-save server function that upserts many rows of `guild_command_settings` at once. No schema change needed — the columns already exist.

## Part 2 — Calendar Sync & Reminder system

### Database (new tables, nothing existing touched)
- `calendar_sources` — guild_id, source_type (google/ical), name, external_calendar_id, ical_url, token references, sync_enabled, last_synced_at, sync_status, sync_error
- `calendar_events` — calendar_source_id, external_event_id, title, description, location, start/end, timezone, is_all_day, is_recurring, recurrence_rule, parent event link, status, external_updated_at; unique on (source, external_event_id, occurrence start) so re-syncs never duplicate
- `event_reminder_defaults` — per-guild default offsets, default channel, default mention
- `event_reminders` — event_id, discord_channel_id, reminder_minutes, scheduled_for, sent_at, status, attempts, error; unique on (event_id, reminder_minutes) so a reminder can never fire twice

All server-only: service-role access, RLS on, no anon grants. Google refresh tokens are stored encrypted with the existing AES-GCM helper used for the Discord session — never returned to the browser.

### Sync service
- iCal: fetch the `.ics` URL server-side, expand RRULEs into occurrences for the next 90 days, honour VTIMEZONE, all-day events, `STATUS:CANCELLED` and `METHOD:CANCEL`
- Google: connect via the App User Connector for Google Calendar so each admin authorises their own account; list calendars, pick which to monitor, import via the events API with `singleEvents` expansion
- Idempotent upsert keyed on (source_type, source_id, external_event_id). Changed events update in place and recalculate only *unsent* future reminders. Cancelled events are marked `cancelled` and their pending reminders cancelled — history is kept.
- Runs on a `pg_cron` job every 5 minutes hitting a public API route, plus a "Sync Now" button that returns the checked/new/updated/cancelled counts.

### Reminder delivery
The Python bot already polls Supabase on a loop (that is how reminders and giveaways work today), so a new `event_reminders` loop fits the existing pattern: claim due rows, post the AHOY-branded embed to the configured channel with a Discord timestamp, mark sent, retry with backoff on failure, never re-send. Nothing runs in the browser.

### Dashboard (new sidebar module "Calendar")
- **Calendar Sources** — connected-source cards with status dot, calendar name, last-synced, and Sync Now / Configure / Disconnect. Clear expired-auth and failed-URL states with a Reconnect action.
- **Event Reminder Automation** — global default offsets (24h/12h/6h/1h/30m/10m/at start) plus custom intervals, default channel and mention.
- **Upcoming Events** list — name, date/time, source, recurring badge, reminder count, target channel.
- **Event detail page** — full event info, Discord automation panel with channel/mention/offset overrides, embed preview, and Save / Send Test Reminder / Sync Event / Disable Reminders.

Test reminders post immediately with a "TEST EVENT REMINDER" label and never touch the schedule.

## Part 3 — "Commands return no data / just a reference ID"

The ~900 library commands currently share one generic handler that records the request and replies with a reference ID. Making all of them return real stats and configuration is a large amount of per-command logic, so it needs to be scoped in waves by category (as with the anti-raid / automod / security / filters wave in your screenshot) rather than done blind in one pass. Once Parts 1 and 2 land I will list the categories and we can pick the next wave.

## What I need from you
- Whether to use the Google Calendar connector for per-admin Google auth (recommended) or a single owner-level Google account.
- Confirmation that Part 3 goes in scoped waves after Parts 1 and 2.
