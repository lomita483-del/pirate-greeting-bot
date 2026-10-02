-- Unified XP controls: message exclusions used by the live XP event handler.
ALTER TABLE public.server_settings
  ADD COLUMN IF NOT EXISTS xp_ignored_channel_ids TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS xp_ignored_role_ids TEXT[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.server_settings.xp_ignored_channel_ids IS 'Discord channel IDs where member messages do not award XP.';
COMMENT ON COLUMN public.server_settings.xp_ignored_role_ids IS 'Discord role IDs whose members do not earn message XP.';
