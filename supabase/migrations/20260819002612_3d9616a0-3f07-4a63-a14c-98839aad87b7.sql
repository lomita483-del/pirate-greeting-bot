CREATE TABLE IF NOT EXISTS public.case_appeals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id TEXT NOT NULL,
  case_id UUID NOT NULL REFERENCES public.moderation_cases(id) ON DELETE CASCADE,
  case_number INTEGER,
  user_id TEXT NOT NULL,
  username TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (case_id, user_id)
);
GRANT ALL ON public.case_appeals TO service_role;
ALTER TABLE public.case_appeals ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id TEXT NOT NULL,
  reporter_id TEXT NOT NULL,
  reporter_name TEXT,
  reported_user_id TEXT NOT NULL,
  reported_user_name TEXT,
  channel_id TEXT,
  message_id TEXT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.user_reports TO service_role;
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.welcome_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL DEFAULT '',
  embed JSONB,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.welcome_messages TO service_role;
ALTER TABLE public.welcome_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS case_appeals_guild_idx ON public.case_appeals (guild_id, status);
CREATE INDEX IF NOT EXISTS user_reports_guild_idx ON public.user_reports (guild_id, status);
CREATE INDEX IF NOT EXISTS welcome_messages_guild_idx ON public.welcome_messages (guild_id, position);