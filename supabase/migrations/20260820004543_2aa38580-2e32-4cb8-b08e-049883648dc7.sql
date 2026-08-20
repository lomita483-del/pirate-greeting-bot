ALTER TABLE public.welcome_messages
  ADD COLUMN IF NOT EXISTS use_embed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS attach_dynamic_image boolean NOT NULL DEFAULT false;

ALTER TABLE public.platform_users
  ADD COLUMN IF NOT EXISTS premium boolean NOT NULL DEFAULT false;

GRANT ALL ON public.welcome_messages TO service_role;
GRANT ALL ON public.platform_users TO service_role;