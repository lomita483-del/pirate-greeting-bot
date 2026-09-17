-- Cinematic user-facing cards + administrator XP controls.
ALTER TABLE public.server_settings
  ADD COLUMN IF NOT EXISTS xp_card_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS xp_card_style text NOT NULL DEFAULT 'glassmorphism',
  ADD COLUMN IF NOT EXISTS xp_card_show_progress boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS xp_card_show_rank boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS xp_card_show_stats boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS xp_card_show_total_xp boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS level_up_card_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS level_up_card_style text NOT NULL DEFAULT 'glassmorphism',
  ADD COLUMN IF NOT EXISTS level_up_card_show_progress boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS level_up_card_show_rank boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS welcome_card_style text NOT NULL DEFAULT 'glassmorphism',
  ADD COLUMN IF NOT EXISTS profile_card_style text NOT NULL DEFAULT 'glassmorphism';

UPDATE public.server_settings
SET xp_card_style = 'glassmorphism'
WHERE xp_card_style IS NULL OR xp_card_style = '';
