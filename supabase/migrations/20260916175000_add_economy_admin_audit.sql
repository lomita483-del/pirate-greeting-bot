CREATE TABLE IF NOT EXISTS public.economy_admin_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL REFERENCES public.servers(guild_id) ON DELETE CASCADE,
  target_user_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('give','remove','set')),
  amount BIGINT NOT NULL CHECK (amount >= 0),
  old_balance BIGINT NOT NULL CHECK (old_balance >= 0),
  new_balance BIGINT NOT NULL CHECK (new_balance >= 0),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS economy_admin_audit_guild_created_idx ON public.economy_admin_audit(guild_id, created_at DESC);
CREATE INDEX IF NOT EXISTS economy_admin_audit_target_idx ON public.economy_admin_audit(guild_id, target_user_id, created_at DESC);
GRANT ALL ON public.economy_admin_audit TO service_role;
ALTER TABLE public.economy_admin_audit ENABLE ROW LEVEL SECURITY;
