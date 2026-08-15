CREATE TABLE IF NOT EXISTS public.guild_command_settings (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  command text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (guild_id, command)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guild_command_settings TO authenticated;
GRANT ALL ON public.guild_command_settings TO service_role;
ALTER TABLE public.guild_command_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service manages command settings" ON public.guild_command_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.guild_feature_state (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (guild_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guild_feature_state TO authenticated;
GRANT ALL ON public.guild_feature_state TO service_role;
ALTER TABLE public.guild_feature_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service manages feature state" ON public.guild_feature_state FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.command_records (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  namespace text not null,
  command text not null,
  label text,
  payload jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS command_records_guild_ns_idx ON public.command_records (guild_id, namespace, created_at desc);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.command_records TO authenticated;
GRANT ALL ON public.command_records TO service_role;
ALTER TABLE public.command_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service manages command records" ON public.command_records FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.command_usage (
  id uuid primary key default gen_random_uuid(),
  guild_id text,
  command text not null,
  category text,
  user_id text,
  created_at timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS command_usage_guild_idx ON public.command_usage (guild_id, created_at desc);
GRANT SELECT, INSERT ON public.command_usage TO authenticated;
GRANT ALL ON public.command_usage TO service_role;
ALTER TABLE public.command_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service manages command usage" ON public.command_usage FOR ALL TO service_role USING (true) WITH CHECK (true);