-- ============================================================
-- AHOY TICKET SYSTEM UPGRADE
-- Per-button routing, forms, permissions and transcripts
-- ============================================================

ALTER TABLE public.server_settings
  ADD COLUMN IF NOT EXISTS ticket_transcript_channel_id TEXT,
  ADD COLUMN IF NOT EXISTS ticket_dm_transcript_enabled BOOLEAN
    NOT NULL DEFAULT false;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS panel_id UUID,
  ADD COLUMN IF NOT EXISTS panel_button_id UUID,
  ADD COLUMN IF NOT EXISTS ticket_category_id TEXT,
  ADD COLUMN IF NOT EXISTS form_answers JSONB
    NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS transcript_channel_id TEXT,
  ADD COLUMN IF NOT EXISTS dm_transcript_enabled BOOLEAN
    NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.ticket_panels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT,

  title TEXT,
  description TEXT,

  created_by TEXT,

  enabled BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_panels_guild_channel
  ON public.ticket_panels(guild_id, channel_id);

CREATE TABLE IF NOT EXISTS public.ticket_panel_buttons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  panel_id UUID NOT NULL
    REFERENCES public.ticket_panels(id)
    ON DELETE CASCADE,

  position INTEGER NOT NULL DEFAULT 0,

  label TEXT NOT NULL,
  description TEXT,

  emoji TEXT,

  style TEXT NOT NULL DEFAULT 'primary'
    CHECK (style IN (
      'primary',
      'secondary',
      'success',
      'danger'
    )),

  -- Discord category where tickets from this button are created.
  category_id TEXT,

  -- Internal ticket type/category.
  category_key TEXT,

  -- Roles that receive access to tickets from this button.
  support_role_ids TEXT[] NOT NULL DEFAULT '{}',

  -- Optional roles allowed to press this button.
  access_role_ids TEXT[] NOT NULL DEFAULT '{}',

  -- Permission requirement for opening the ticket.
  required_permission TEXT NOT NULL DEFAULT 'everyone',

  -- Discord modal questions.
  form_questions JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Transcript settings.
  transcript_enabled BOOLEAN NOT NULL DEFAULT true,
  transcript_channel_id TEXT,
  dm_transcript_enabled BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_panel_buttons_panel_position
  ON public.ticket_panel_buttons(panel_id, position);

ALTER TABLE public.tickets
  DROP CONSTRAINT IF EXISTS tickets_panel_id_fkey;

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_panel_id_fkey
  FOREIGN KEY (panel_id)
  REFERENCES public.ticket_panels(id)
  ON DELETE SET NULL;

ALTER TABLE public.tickets
  DROP CONSTRAINT IF EXISTS tickets_panel_button_id_fkey;

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_panel_button_id_fkey
  FOREIGN KEY (panel_button_id)
  REFERENCES public.ticket_panel_buttons(id)
  ON DELETE SET NULL;

ALTER TABLE public.ticket_panels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_panel_buttons ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.ticket_panels IS
  'AHOY persistent ticket panels created from the dashboard.';

COMMENT ON TABLE public.ticket_panel_buttons IS
  'AHOY per-button ticket routing, permissions, forms and transcript settings.';
