ALTER TABLE public.role_settings
  ADD COLUMN IF NOT EXISTS level_roles_enabled BOOLEAN NOT NULL DEFAULT true;
