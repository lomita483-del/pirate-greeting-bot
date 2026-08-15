ALTER TABLE public.guild_command_settings
  ADD COLUMN IF NOT EXISTS blocked_channel_ids text[] not null default '{}',
  ADD COLUMN IF NOT EXISTS allowed_category_ids text[] not null default '{}',
  ADD COLUMN IF NOT EXISTS protected_role_ids text[] not null default '{}',
  ADD COLUMN IF NOT EXISTS protected_user_ids text[] not null default '{}',
  ADD COLUMN IF NOT EXISTS rate_limit_per_minute integer not null default 0,
  ADD COLUMN IF NOT EXISTS require_reason boolean not null default false,
  ADD COLUMN IF NOT EXISTS require_confirmation boolean not null default false,
  ADD COLUMN IF NOT EXISTS response_visibility text not null default 'inherit',
  ADD COLUMN IF NOT EXISTS error_response text,
  ADD COLUMN IF NOT EXISTS log_event boolean not null default true,
  ADD COLUMN IF NOT EXISTS log_channel_id text,
  ADD COLUMN IF NOT EXISTS notify_role_id text,
  ADD COLUMN IF NOT EXISTS notify_channel_id text;

CREATE TABLE IF NOT EXISTS public.system_events (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  event_type text not null,
  actor_id text,
  target_id text,
  resource_type text,
  resource_id text,
  case_id text,
  channel_id text,
  source text not null default 'discord',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS system_events_guild_idx ON public.system_events (guild_id, created_at desc);
CREATE INDEX IF NOT EXISTS system_events_type_idx ON public.system_events (guild_id, event_type, created_at desc);
GRANT SELECT ON public.system_events TO authenticated;
GRANT ALL ON public.system_events TO service_role;
ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service manages system events" ON public.system_events FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  event_id uuid references public.system_events(id) on delete set null,
  action text not null,
  actor_id text,
  target_id text,
  resource_type text,
  resource_id text,
  before_state jsonb,
  after_state jsonb,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS audit_logs_guild_idx ON public.audit_logs (guild_id, created_at desc);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service manages audit logs" ON public.audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);