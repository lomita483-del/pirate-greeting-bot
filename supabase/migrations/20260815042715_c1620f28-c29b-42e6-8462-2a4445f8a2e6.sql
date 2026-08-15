ALTER TABLE public.guild_command_settings
  ADD COLUMN IF NOT EXISTS allowed_role_ids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS denied_role_ids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS required_permission text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS allowed_channel_ids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS output_channel_id text,
  ADD COLUMN IF NOT EXISTS cooldown_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ephemeral boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS custom_response text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS options jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.command_cooldowns (
  guild_id text NOT NULL,
  command text NOT NULL,
  user_id text NOT NULL,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, command, user_id)
);

GRANT ALL ON public.command_cooldowns TO service_role;
ALTER TABLE public.command_cooldowns ENABLE ROW LEVEL SECURITY;