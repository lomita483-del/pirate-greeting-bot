-- !HOY BOT support + error workflow

CREATE TABLE IF NOT EXISTS public.user_support_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  username TEXT,
  display_name TEXT,
  subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  admin_reply TEXT,
  replied_by TEXT,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_support_reports_status_idx ON public.user_support_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS user_support_reports_user_idx ON public.user_support_reports(user_id, created_at DESC);

ALTER TABLE public.bot_error_logs
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','fixed')),
  ADD COLUMN IF NOT EXISTS cause TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS context TEXT,
  ADD COLUMN IF NOT EXISTS resolved_by TEXT,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

GRANT ALL ON public.user_support_reports TO service_role;
ALTER TABLE public.user_support_reports ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_user_support_reports_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_support_reports_updated_at ON public.user_support_reports;
CREATE TRIGGER user_support_reports_updated_at
BEFORE UPDATE ON public.user_support_reports
FOR EACH ROW EXECUTE FUNCTION public.update_user_support_reports_updated_at();