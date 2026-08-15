CREATE TABLE public.calendar_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL REFERENCES public.servers(guild_id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('google','ical')),
  name text NOT NULL,
  external_calendar_id text,
  ical_url text,
  access_token_reference text,
  refresh_token_reference text,
  connected_by text,
  sync_enabled boolean NOT NULL DEFAULT true,
  sync_interval_minutes integer NOT NULL DEFAULT 5,
  last_synced_at timestamptz,
  sync_status text NOT NULL DEFAULT 'pending',
  sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX calendar_sources_google_unique ON public.calendar_sources (guild_id, external_calendar_id) WHERE source_type = 'google';
CREATE UNIQUE INDEX calendar_sources_ical_unique ON public.calendar_sources (guild_id, ical_url) WHERE source_type = 'ical';
GRANT ALL ON public.calendar_sources TO service_role;
ALTER TABLE public.calendar_sources ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_source_id uuid NOT NULL REFERENCES public.calendar_sources(id) ON DELETE CASCADE,
  guild_id text NOT NULL REFERENCES public.servers(guild_id) ON DELETE CASCADE,
  external_event_id text NOT NULL,
  parent_external_event_id text,
  title text NOT NULL,
  description text,
  location text,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  timezone text NOT NULL DEFAULT 'UTC',
  is_all_day boolean NOT NULL DEFAULT false,
  is_recurring boolean NOT NULL DEFAULT false,
  recurrence_rule text,
  status text NOT NULL DEFAULT 'confirmed',
  html_link text,
  discord_channel_id text,
  mention text,
  reminder_offsets integer[],
  reminders_enabled boolean NOT NULL DEFAULT true,
  external_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (calendar_source_id, external_event_id, start_time)
);
CREATE INDEX calendar_events_guild_start_idx ON public.calendar_events (guild_id, start_time);
GRANT ALL ON public.calendar_events TO service_role;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.event_reminder_defaults (
  guild_id text PRIMARY KEY REFERENCES public.servers(guild_id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  offsets integer[] NOT NULL DEFAULT ARRAY[1440,60,10,0],
  discord_channel_id text,
  mention text NOT NULL DEFAULT 'none',
  timezone text NOT NULL DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.event_reminder_defaults TO service_role;
ALTER TABLE public.event_reminder_defaults ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.event_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  guild_id text NOT NULL REFERENCES public.servers(guild_id) ON DELETE CASCADE,
  discord_channel_id text NOT NULL,
  mention text NOT NULL DEFAULT 'none',
  reminder_minutes integer NOT NULL,
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, reminder_minutes)
);
CREATE INDEX event_reminders_due_idx ON public.event_reminders (status, scheduled_for);
GRANT ALL ON public.event_reminders TO service_role;
ALTER TABLE public.event_reminders ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER calendar_sources_updated_at BEFORE UPDATE ON public.calendar_sources FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER calendar_events_updated_at BEFORE UPDATE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER event_reminder_defaults_updated_at BEFORE UPDATE ON public.event_reminder_defaults FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER event_reminders_updated_at BEFORE UPDATE ON public.event_reminders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();