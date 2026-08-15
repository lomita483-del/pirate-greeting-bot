CREATE TABLE public.moderation_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL REFERENCES public.servers(guild_id) ON DELETE CASCADE,
  case_number integer NOT NULL,
  action text NOT NULL,
  target_id text,
  target_name text,
  moderator_id text,
  moderator_name text,
  reason text NOT NULL DEFAULT 'No reason provided',
  duration_seconds integer,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  voided boolean NOT NULL DEFAULT false,
  voided_by text,
  voided_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guild_id, case_number)
);
CREATE INDEX moderation_cases_guild_created_idx ON public.moderation_cases (guild_id, created_at DESC);
CREATE INDEX moderation_cases_guild_target_idx ON public.moderation_cases (guild_id, target_id, created_at DESC);
CREATE INDEX moderation_cases_guild_action_idx ON public.moderation_cases (guild_id, action, created_at DESC);
GRANT ALL ON public.moderation_cases TO service_role;
ALTER TABLE public.moderation_cases ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER moderation_cases_updated_at BEFORE UPDATE ON public.moderation_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.next_case_number(_guild_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('ahoy_case:' || _guild_id));
  SELECT COALESCE(MAX(case_number), 0) + 1 INTO next_number
  FROM public.moderation_cases WHERE guild_id = _guild_id;
  RETURN next_number;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.next_case_number(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_case_number(text) TO service_role;

CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL REFERENCES public.servers(guild_id) ON DELETE CASCADE,
  category text NOT NULL,
  actor_id text,
  actor_name text,
  target_id text,
  target_name text,
  channel_id text,
  channel_name text,
  summary text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_logs_guild_created_idx ON public.activity_logs (guild_id, created_at DESC);
CREATE INDEX activity_logs_guild_category_idx ON public.activity_logs (guild_id, category, created_at DESC);
CREATE INDEX activity_logs_guild_actor_idx ON public.activity_logs (guild_id, actor_id, created_at DESC);
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.bot_action_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL REFERENCES public.servers(guild_id) ON DELETE CASCADE,
  action text NOT NULL,
  target_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_by text,
  requested_by_name text,
  status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX bot_action_queue_pending_idx ON public.bot_action_queue (status, created_at);
CREATE INDEX bot_action_queue_guild_idx ON public.bot_action_queue (guild_id, created_at DESC);
GRANT ALL ON public.bot_action_queue TO service_role;
ALTER TABLE public.bot_action_queue ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.voice_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL REFERENCES public.servers(guild_id) ON DELETE CASCADE,
  user_id text NOT NULL,
  username text,
  voice_seconds bigint NOT NULL DEFAULT 0,
  sessions integer NOT NULL DEFAULT 0,
  last_joined_at timestamptz,
  last_left_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guild_id, user_id)
);
CREATE INDEX voice_stats_guild_seconds_idx ON public.voice_stats (guild_id, voice_seconds DESC);
GRANT ALL ON public.voice_stats TO service_role;
ALTER TABLE public.voice_stats ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER voice_stats_updated_at BEFORE UPDATE ON public.voice_stats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();