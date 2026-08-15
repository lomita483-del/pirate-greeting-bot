CREATE TABLE public.polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL REFERENCES public.servers(guild_id) ON DELETE CASCADE,
  channel_id text NOT NULL,
  message_id text,
  question text NOT NULL,
  options text[] NOT NULL DEFAULT '{}'::text[],
  votes jsonb NOT NULL DEFAULT '{}'::jsonb,
  multi_choice boolean NOT NULL DEFAULT false,
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'open',
  created_by text,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.polls TO service_role;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
CREATE INDEX polls_guild_idx ON public.polls (guild_id);
CREATE INDEX polls_message_idx ON public.polls (message_id);
CREATE INDEX polls_due_idx ON public.polls (status, ends_at);
CREATE TRIGGER polls_updated_at BEFORE UPDATE ON public.polls FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.starboard_settings (
  guild_id text PRIMARY KEY REFERENCES public.servers(guild_id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  channel_id text,
  emoji text NOT NULL DEFAULT '⭐',
  threshold integer NOT NULL DEFAULT 3,
  allow_self_star boolean NOT NULL DEFAULT false,
  ignored_channel_ids text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.starboard_settings TO service_role;
ALTER TABLE public.starboard_settings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER starboard_settings_updated_at BEFORE UPDATE ON public.starboard_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.starboard_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL REFERENCES public.servers(guild_id) ON DELETE CASCADE,
  source_message_id text NOT NULL UNIQUE,
  source_channel_id text NOT NULL,
  author_id text,
  author_name text,
  starboard_message_id text,
  star_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.starboard_entries TO service_role;
ALTER TABLE public.starboard_entries ENABLE ROW LEVEL SECURITY;
CREATE INDEX starboard_entries_guild_idx ON public.starboard_entries (guild_id);
CREATE TRIGGER starboard_entries_updated_at BEFORE UPDATE ON public.starboard_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.scheduled_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL REFERENCES public.servers(guild_id) ON DELETE CASCADE,
  channel_id text NOT NULL,
  name text NOT NULL DEFAULT 'Announcement',
  message text NOT NULL,
  use_embed boolean NOT NULL DEFAULT false,
  embed_title text,
  embed_color text NOT NULL DEFAULT '#1FB6A6',
  recurrence text NOT NULL DEFAULT 'daily',
  weekday integer,
  time_of_day text NOT NULL DEFAULT '12:00',
  timezone text NOT NULL DEFAULT 'UTC',
  enabled boolean NOT NULL DEFAULT true,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  last_run_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.scheduled_announcements TO service_role;
ALTER TABLE public.scheduled_announcements ENABLE ROW LEVEL SECURITY;
CREATE INDEX scheduled_announcements_guild_idx ON public.scheduled_announcements (guild_id);
CREATE INDEX scheduled_announcements_due_idx ON public.scheduled_announcements (enabled, next_run_at);
CREATE TRIGGER scheduled_announcements_updated_at BEFORE UPDATE ON public.scheduled_announcements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.stat_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL REFERENCES public.servers(guild_id) ON DELETE CASCADE,
  channel_id text NOT NULL,
  kind text NOT NULL DEFAULT 'members',
  name_template text NOT NULL DEFAULT 'Members: {count}',
  enabled boolean NOT NULL DEFAULT true,
  last_value integer,
  last_updated_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guild_id, channel_id)
);
GRANT ALL ON public.stat_channels TO service_role;
ALTER TABLE public.stat_channels ENABLE ROW LEVEL SECURITY;
CREATE INDEX stat_channels_guild_idx ON public.stat_channels (guild_id);
CREATE TRIGGER stat_channels_updated_at BEFORE UPDATE ON public.stat_channels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();