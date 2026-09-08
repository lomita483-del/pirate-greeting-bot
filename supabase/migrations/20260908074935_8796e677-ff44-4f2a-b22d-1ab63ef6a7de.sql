ALTER TABLE public.welcome_messages
  ADD COLUMN IF NOT EXISTS send_dm boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dm_only boolean NOT NULL DEFAULT false;