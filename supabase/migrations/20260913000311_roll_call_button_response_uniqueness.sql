-- A member may choose more than one purpose-specific button on the same panel.
ALTER TABLE public.roll_call_responses
  DROP CONSTRAINT IF EXISTS roll_call_responses_roll_call_id_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS roll_call_responses_roll_call_user_button_key
  ON public.roll_call_responses (roll_call_id, user_id, button_id);
