-- Panels ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ticket_panels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT,
  title TEXT,
  description TEXT,
  created_by TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.ticket_panels TO service_role;
ALTER TABLE public.ticket_panels ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ticket_panels_guild
  ON public.ticket_panels(guild_id, enabled);

DROP TRIGGER IF EXISTS ticket_panels_updated_at ON public.ticket_panels;
CREATE TRIGGER ticket_panels_updated_at
  BEFORE UPDATE ON public.ticket_panels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Buttons ---------------------------------------------------------
ALTER TABLE public.ticket_panel_buttons
  ADD COLUMN IF NOT EXISTS panel_id UUID REFERENCES public.ticket_panels(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category_id TEXT,
  ADD COLUMN IF NOT EXISTS category_key TEXT,
  ADD COLUMN IF NOT EXISTS access_role_ids TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS required_permission TEXT NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS form_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS transcript_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS transcript_channel_id TEXT,
  ADD COLUMN IF NOT EXISTS dm_transcript_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT true;

UPDATE public.ticket_panel_buttons
  SET category_id = COALESCE(category_id, category_channel_id),
      category_key = COALESCE(category_key, category),
      form_questions = CASE
        WHEN form_questions = '[]'::jsonb AND form_fields IS NOT NULL THEN form_fields
        ELSE form_questions
      END;

GRANT ALL ON public.ticket_panel_buttons TO service_role;

CREATE INDEX IF NOT EXISTS idx_ticket_panel_buttons_panel_position
  ON public.ticket_panel_buttons(panel_id, position);

-- Tickets ---------------------------------------------------------
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS panel_id UUID,
  ADD COLUMN IF NOT EXISTS panel_button_id UUID,
  ADD COLUMN IF NOT EXISTS button_label TEXT,
  ADD COLUMN IF NOT EXISTS ticket_category_id TEXT,
  ADD COLUMN IF NOT EXISTS support_role_ids TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS transcript_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS transcript_channel_id TEXT,
  ADD COLUMN IF NOT EXISTS dm_transcript_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.tickets
  ALTER COLUMN form_answers SET DEFAULT '{}'::jsonb;

-- Server settings -------------------------------------------------
ALTER TABLE public.server_settings
  ADD COLUMN IF NOT EXISTS ticket_transcript_channel_id TEXT,
  ADD COLUMN IF NOT EXISTS ticket_dm_transcript_enabled BOOLEAN NOT NULL DEFAULT false;