ALTER TABLE public.server_settings
  ADD COLUMN IF NOT EXISTS mention_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS mention_response_mode TEXT NOT NULL DEFAULT 'reply' CHECK (mention_response_mode IN ('reply', 'channel')),
  ADD COLUMN IF NOT EXISTS mention_response TEXT NOT NULL DEFAULT 'Ahoy {user}! I''m on deck. Ask me for **help** or **status**, or use `/help` to explore the command navigator.',
  ADD COLUMN IF NOT EXISTS mention_cooldown_seconds INTEGER NOT NULL DEFAULT 3 CHECK (mention_cooldown_seconds BETWEEN 0 AND 3600);
