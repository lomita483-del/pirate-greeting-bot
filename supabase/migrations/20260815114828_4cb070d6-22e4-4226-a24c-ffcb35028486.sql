
-- A. Event feed settings on calendar sources
ALTER TABLE public.calendar_sources
  ADD COLUMN IF NOT EXISTS target_channel_id text,
  ADD COLUMN IF NOT EXISTS calendar_id text,
  ADD COLUMN IF NOT EXISTS voice_channel_duration_default integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS lookahead_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS sync_direction text NOT NULL DEFAULT 'gcal_to_discord',
  ADD COLUMN IF NOT EXISTS allowed_category_ids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS create_discord_events boolean NOT NULL DEFAULT false;

-- C. Message & embed templates
CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL,
  name text NOT NULL,
  template_type text NOT NULL DEFAULT 'reminder',
  raw_structure jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guild_id, name)
);
GRANT ALL ON public.message_templates TO service_role;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- B. Event notifiers
CREATE TABLE IF NOT EXISTS public.event_notifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL,
  name text NOT NULL DEFAULT 'Event notifier',
  channel_id text NOT NULL,
  category_id text,
  calendar_source_id uuid REFERENCES public.calendar_sources(id) ON DELETE CASCADE,
  reminder_offsets integer[] NOT NULL DEFAULT '{1440,60,10,0}',
  role_mentions text[] NOT NULL DEFAULT '{}',
  cleanup_previous boolean NOT NULL DEFAULT false,
  template_id uuid REFERENCES public.message_templates(id) ON DELETE SET NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.event_notifiers TO service_role;
ALTER TABLE public.event_notifiers ENABLE ROW LEVEL SECURITY;

-- RSVPs
CREATE TABLE IF NOT EXISTS public.event_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  guild_id text NOT NULL,
  user_id text NOT NULL,
  response text NOT NULL DEFAULT 'attending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
GRANT ALL ON public.event_rsvps TO service_role;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

-- Summaries
CREATE TABLE IF NOT EXISTS public.event_summary_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  channel_id text,
  cadence text NOT NULL DEFAULT 'daily',
  hour_utc integer NOT NULL DEFAULT 8,
  pin_message boolean NOT NULL DEFAULT true,
  template_id uuid REFERENCES public.message_templates(id) ON DELETE SET NULL,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.event_summary_schedules TO service_role;
ALTER TABLE public.event_summary_schedules ENABLE ROW LEVEL SECURITY;

-- Event + reminder linkage columns
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS discord_event_id text,
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS created_in_discord boolean NOT NULL DEFAULT false;

ALTER TABLE public.event_reminders
  ADD COLUMN IF NOT EXISTS notifier_id uuid REFERENCES public.event_notifiers(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.message_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS message_id text,
  ADD COLUMN IF NOT EXISTS role_mentions text[] NOT NULL DEFAULT '{}';

-- Reminders must stay unique per (event, notifier, offset)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_reminders_event_id_reminder_minutes_key'
  ) THEN
    ALTER TABLE public.event_reminders
      DROP CONSTRAINT event_reminders_event_id_reminder_minutes_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS event_reminders_event_notifier_offset_idx
  ON public.event_reminders (event_id, COALESCE(notifier_id, '00000000-0000-0000-0000-000000000000'::uuid), reminder_minutes);

CREATE INDEX IF NOT EXISTS event_notifiers_guild_idx ON public.event_notifiers (guild_id);
CREATE INDEX IF NOT EXISTS message_templates_guild_idx ON public.message_templates (guild_id);
CREATE INDEX IF NOT EXISTS event_rsvps_event_idx ON public.event_rsvps (event_id);
