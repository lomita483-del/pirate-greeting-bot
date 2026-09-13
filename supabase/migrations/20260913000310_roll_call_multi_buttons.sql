-- Roll Call panels can contain multiple purpose-specific buttons.
-- Each button is stored on the roll call so old panels keep their exact configuration.
ALTER TABLE public.roll_calls
  ADD COLUMN IF NOT EXISTS buttons jsonb NOT NULL DEFAULT '[{"id":"present","label":"Present","emoji":"✅","style":"success","purpose":"Record attendance"}]'::jsonb;

ALTER TABLE public.roll_call_responses
  ADD COLUMN IF NOT EXISTS button_id text NOT NULL DEFAULT 'present';

ALTER TABLE public.roll_call_responses
  ADD COLUMN IF NOT EXISTS button_label text;

ALTER TABLE public.roll_call_responses
  ADD COLUMN IF NOT EXISTS button_purpose text;

CREATE INDEX IF NOT EXISTS roll_call_responses_button_idx
  ON public.roll_call_responses (roll_call_id, button_id);
