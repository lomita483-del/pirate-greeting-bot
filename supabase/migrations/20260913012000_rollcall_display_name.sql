ALTER TABLE public.roll_call_responses
  ADD COLUMN IF NOT EXISTS display_name TEXT;

CREATE INDEX IF NOT EXISTS roll_call_responses_roll_call_id_idx
  ON public.roll_call_responses (roll_call_id);

CREATE INDEX IF NOT EXISTS roll_call_responses_guild_user_idx
  ON public.roll_call_responses (guild_id, user_id);
