CREATE TABLE IF NOT EXISTS public.roll_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL,
  mode text NOT NULL DEFAULT 'event',
  title text NOT NULL,
  description text,
  channel_id text,
  message_id text,
  target_role_ids text[] NOT NULL DEFAULT '{}',
  opens_at timestamptz NOT NULL DEFAULT now(),
  closes_at timestamptz,
  status text NOT NULL DEFAULT 'open',
  created_by text,
  closed_at timestamptz,
  results jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.roll_calls TO service_role;
ALTER TABLE public.roll_calls ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS roll_calls_guild_idx ON public.roll_calls (guild_id, created_at DESC);
CREATE INDEX IF NOT EXISTS roll_calls_status_idx ON public.roll_calls (status, closes_at);

CREATE TRIGGER roll_calls_updated_at BEFORE UPDATE ON public.roll_calls
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.roll_call_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_call_id uuid NOT NULL REFERENCES public.roll_calls(id) ON DELETE CASCADE,
  guild_id text NOT NULL,
  user_id text NOT NULL,
  username text,
  responded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (roll_call_id, user_id)
);
GRANT ALL ON public.roll_call_responses TO service_role;
ALTER TABLE public.roll_call_responses ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS roll_call_responses_rc_idx ON public.roll_call_responses (roll_call_id);

CREATE TABLE IF NOT EXISTS public.roll_call_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL,
  user_id text NOT NULL,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_checked_in_at timestamptz,
  last_checked_in_day date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guild_id, user_id)
);
GRANT ALL ON public.roll_call_streaks TO service_role;
ALTER TABLE public.roll_call_streaks ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER roll_call_streaks_updated_at BEFORE UPDATE ON public.roll_call_streaks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.server_settings
  ADD COLUMN IF NOT EXISTS rollcall_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rollcall_manager_roles text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rollcall_channel_id text,
  ADD COLUMN IF NOT EXISTS rollcall_daily_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rollcall_daily_time text NOT NULL DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS rollcall_daily_last_posted_day date;