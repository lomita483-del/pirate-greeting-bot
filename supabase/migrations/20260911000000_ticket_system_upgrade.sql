-- AHOY Ticket System Upgrade
-- Per-button categories, roles, forms and transcripts.

BEGIN;

-- ------------------------------------------------------------
-- SERVER SETTINGS
-- ------------------------------------------------------------

ALTER TABLE public.server_settings
  ADD COLUMN IF NOT EXISTS ticket_transcript_channel_id TEXT;

ALTER TABLE public.server_settings
  ADD COLUMN IF NOT EXISTS ticket_dm_transcript_enabled BOOLEAN
  NOT NULL DEFAULT false;


-- ------------------------------------------------------------
-- TICKETS
-- ------------------------------------------------------------

-- The old schema only allowed:
-- general / report / partnership / other
--
-- Dashboard-created buttons can now have arbitrary ticket types.
ALTER TABLE public.tickets
  DROP CONSTRAINT IF EXISTS tickets_category_check;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS button_id UUID;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS button_label TEXT;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS support_role_ids TEXT[]
  NOT NULL DEFAULT '{}';

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS access_role_ids TEXT[]
  NOT NULL DEFAULT '{}';

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS required_permission TEXT
  NOT NULL DEFAULT 'everyone';

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS form_answers JSONB
  NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS transcript_enabled BOOLEAN
  NOT NULL DEFAULT true;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS transcript_channel_id TEXT;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS dm_transcript_enabled BOOLEAN
  NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS tickets_button_id_idx
  ON public.tickets(button_id);

CREATE INDEX IF NOT EXISTS tickets_channel_id_idx
  ON public.tickets(channel_id);


-- ------------------------------------------------------------
-- TICKET PANELS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ticket_panels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  guild_id TEXT NOT NULL
    REFERENCES public.servers(guild_id)
    ON DELETE CASCADE,

  channel_id TEXT NOT NULL,

  message_id TEXT,

  title TEXT,

  description TEXT,

  created_by TEXT,

  enabled BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ticket_panels_guild_idx
  ON public.ticket_panels(guild_id);

CREATE INDEX IF NOT EXISTS ticket_panels_message_idx
  ON public.ticket_panels(message_id);

GRANT ALL ON public.ticket_panels TO service_role;

ALTER TABLE public.ticket_panels
  ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------
-- TICKET PANEL BUTTONS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ticket_panel_buttons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  panel_id UUID NOT NULL
    REFERENCES public.ticket_panels(id)
    ON DELETE CASCADE,

  guild_id TEXT NOT NULL
    REFERENCES public.servers(guild_id)
    ON DELETE CASCADE,

  position INTEGER NOT NULL DEFAULT 0,

  label TEXT NOT NULL,

  description TEXT,

  emoji TEXT,

  style TEXT NOT NULL DEFAULT 'primary',

  -- Discord category channel ID
  category_id TEXT,

  -- Compatibility alias
  category_channel_id TEXT,

  -- Internal ticket type
  category TEXT,

  category_key TEXT,

  -- Staff roles
  support_role_ids TEXT[]
  NOT NULL DEFAULT '{}',

  -- Roles allowed to use the button
  access_role_ids TEXT[]
  NOT NULL DEFAULT '{}',

  -- Discord permission required
  required_permission TEXT
  NOT NULL DEFAULT 'everyone',

  -- Discord modal questions
  form_questions JSONB
  NOT NULL DEFAULT '[]'::jsonb,

  -- Compatibility alias
  form_fields JSONB
  NOT NULL DEFAULT '[]'::jsonb,

  -- Transcript destination
  transcript_enabled BOOLEAN
  NOT NULL DEFAULT true,

  transcript_channel_id TEXT,

  -- DM transcript
  dm_transcript_enabled BOOLEAN
  NOT NULL DEFAULT false,

  enabled BOOLEAN
  NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ
  NOT NULL DEFAULT now(),

  updated_at TIMESTAMPTZ
  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ticket_panel_buttons_panel_idx
  ON public.ticket_panel_buttons(panel_id);

CREATE INDEX IF NOT EXISTS ticket_panel_buttons_guild_idx
  ON public.ticket_panel_buttons(guild_id);

CREATE INDEX IF NOT EXISTS ticket_panel_buttons_category_idx
  ON public.ticket_panel_buttons(category_id);

GRANT ALL ON public.ticket_panel_buttons TO service_role;

ALTER TABLE public.ticket_panel_buttons
  ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------
-- UPDATED_AT TRIGGERS
-- ------------------------------------------------------------

DROP TRIGGER IF EXISTS ticket_panels_updated_at
ON public.ticket_panels;

CREATE TRIGGER ticket_panels_updated_at
BEFORE UPDATE ON public.ticket_panels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


DROP TRIGGER IF EXISTS ticket_panel_buttons_updated_at
ON public.ticket_panel_buttons;

CREATE TRIGGER ticket_panel_buttons_updated_at
BEFORE UPDATE ON public.ticket_panel_buttons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


COMMIT;
