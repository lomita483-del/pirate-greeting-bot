-- XP progression model: 7.5 XP/message, 150 XP/level, rank +1 every 2 levels.
-- xp_profiles.xp and server_settings.xp_per_message must support 7.5 exactly.
ALTER TABLE public.xp_profiles
  ALTER COLUMN xp TYPE NUMERIC(12,1)
  USING xp::numeric;

ALTER TABLE public.server_settings
  ALTER COLUMN xp_per_message TYPE NUMERIC(6,1)
  USING xp_per_message::numeric;

ALTER TABLE public.server_settings
  ALTER COLUMN xp_per_message SET DEFAULT 7.5;

-- Apply the new default to servers still using the original 15 XP/message setting.
UPDATE public.server_settings
SET xp_per_message = 7.5
WHERE xp_per_message = 15;

-- Existing materialized levels are recalculated from stored XP.
UPDATE public.xp_profiles
SET level = GREATEST(1, FLOOR(xp / 150) + 1);
