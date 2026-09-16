CREATE TABLE IF NOT EXISTS public.xp_admin_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL REFERENCES public.servers(guild_id) ON DELETE CASCADE,
  target_user_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('give','remove','set')),
  amount INTEGER NOT NULL CHECK (amount >= 0),
  old_xp INTEGER NOT NULL CHECK (old_xp >= 0),
  new_xp INTEGER NOT NULL CHECK (new_xp >= 0),
  old_level INTEGER NOT NULL CHECK (old_level >= 0),
  new_level INTEGER NOT NULL CHECK (new_level >= 0),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS xp_admin_audit_guild_created_idx
  ON public.xp_admin_audit(guild_id, created_at DESC);

CREATE INDEX IF NOT EXISTS xp_admin_audit_target_idx
  ON public.xp_admin_audit(guild_id, target_user_id, created_at DESC);

GRANT ALL ON public.xp_admin_audit TO service_role;
ALTER TABLE public.xp_admin_audit ENABLE ROW LEVEL SECURITY;
