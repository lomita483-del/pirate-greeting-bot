-- Advanced giveaway storage for persistent button entry, requirements and weighted draws.
ALTER TABLE public.giveaways
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.giveaway_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id UUID NOT NULL REFERENCES public.giveaways(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 1 CHECK (weight BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (giveaway_id, user_id)
);

GRANT ALL ON public.giveaway_entries TO service_role;
ALTER TABLE public.giveaway_entries ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS giveaway_entries_giveaway_idx ON public.giveaway_entries (giveaway_id);
CREATE INDEX IF NOT EXISTS giveaway_entries_user_idx ON public.giveaway_entries (user_id);
CREATE TRIGGER giveaway_entries_updated_at
BEFORE UPDATE ON public.giveaway_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Make due-giveaway lookup efficient as the number of giveaways grows.
CREATE INDEX IF NOT EXISTS giveaways_running_due_idx
  ON public.giveaways (status, ends_at)
  WHERE status = 'running';
