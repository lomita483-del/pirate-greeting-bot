-- Configurable XP progression.
-- Default: 7.5 XP per message, 200 XP per level, +1 crew rank every 2 levels.
ALTER TABLE public.server_settings
  ADD COLUMN IF NOT EXISTS xp_per_level NUMERIC(10,1) NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS rank_every_levels INTEGER NOT NULL DEFAULT 2;

ALTER TABLE public.server_settings
  ALTER COLUMN xp_per_message TYPE NUMERIC(6,1)
  USING xp_per_message::numeric;

ALTER TABLE public.server_settings
  ALTER COLUMN xp_per_message SET DEFAULT 7.5;

UPDATE public.server_settings
SET xp_per_level = 200,
    rank_every_levels = 2,
    xp_per_message = 7.5
WHERE xp_per_level IS NULL
   OR xp_per_level <= 0
   OR rank_every_levels IS NULL
   OR rank_every_levels <= 0
   OR xp_per_message = 15;

UPDATE public.xp_profiles
SET level = GREATEST(1, CEIL(xp / 200.0)::integer);
