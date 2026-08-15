-- Notifier: full specification fields ---------------------------------
ALTER TABLE public.event_notifiers
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS link_mode text NOT NULL DEFAULT 'automatic',
  ADD COLUMN IF NOT EXISTS custom_link text,
  ADD COLUMN IF NOT EXISTS detection_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS use_calendar_reminders boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurring_mode text NOT NULL DEFAULT 'each_occurrence',
  ADD COLUMN IF NOT EXISTS cleanup_mode text NOT NULL DEFAULT 'keep',
  ADD COLUMN IF NOT EXISTS mention_target text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS reminder_channel_id text,
  ADD COLUMN IF NOT EXISTS summary_channel_id text,
  ADD COLUMN IF NOT EXISTS activity_channel_id text,
  ADD COLUMN IF NOT EXISTS error_channel_id text,
  ADD COLUMN IF NOT EXISTS announce_created boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS announce_updated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS announce_cancelled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS announce_entering_range boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurring_activity_messages boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS activity_template_id uuid REFERENCES public.message_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS front_matter jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS health_status text NOT NULL DEFAULT 'healthy',
  ADD COLUMN IF NOT EXISTS health_error text,
  ADD COLUMN IF NOT EXISTS last_run_at timestamptz;

-- Calendar sources: health + timezone ----------------------------------
ALTER TABLE public.calendar_sources
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS account_label text;

-- Summaries: range and behaviour ---------------------------------------
ALTER TABLE public.event_summary_schedules
  ADD COLUMN IF NOT EXISTS range_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS skip_empty boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cleanup_previous boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS group_by_day boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_message_id text;

-- Event filters ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calendar_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL REFERENCES public.servers(guild_id) ON DELETE CASCADE,
  notifier_id uuid REFERENCES public.event_notifiers(id) ON DELETE CASCADE,
  field text NOT NULL DEFAULT 'title',
  operator text NOT NULL DEFAULT 'contains',
  value text NOT NULL DEFAULT '',
  action text NOT NULL DEFAULT 'include',
  priority integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.calendar_filters TO service_role;
ALTER TABLE public.calendar_filters ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER calendar_filters_updated_at BEFORE UPDATE ON public.calendar_filters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS calendar_filters_notifier_idx ON public.calendar_filters (notifier_id);

-- Execution log ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calendar_job_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL REFERENCES public.servers(guild_id) ON DELETE CASCADE,
  notifier_id uuid REFERENCES public.event_notifiers(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.calendar_events(id) ON DELETE SET NULL,
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  attempts integer NOT NULL DEFAULT 1,
  error text,
  discord_message_id text,
  discord_event_id text,
  channel_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  executed_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.calendar_job_log TO service_role;
ALTER TABLE public.calendar_job_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS calendar_job_log_guild_idx ON public.calendar_job_log (guild_id, executed_at DESC);