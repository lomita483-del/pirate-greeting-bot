CREATE TABLE public.reaction_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL REFERENCES public.servers(guild_id) ON DELETE CASCADE,
  channel_id text NOT NULL,
  message_id text NOT NULL,
  emoji text NOT NULL,
  role_id text NOT NULL,
  description text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, emoji)
);
GRANT ALL ON public.reaction_roles TO service_role;
ALTER TABLE public.reaction_roles ENABLE ROW LEVEL SECURITY;
CREATE INDEX reaction_roles_guild_idx ON public.reaction_roles (guild_id);
CREATE INDEX reaction_roles_message_idx ON public.reaction_roles (message_id);
CREATE TRIGGER reaction_roles_updated_at BEFORE UPDATE ON public.reaction_roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.giveaways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL REFERENCES public.servers(guild_id) ON DELETE CASCADE,
  channel_id text NOT NULL,
  message_id text,
  prize text NOT NULL,
  winner_count integer NOT NULL DEFAULT 1,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'running',
  winner_ids text[] NOT NULL DEFAULT '{}'::text[],
  host_id text,
  host_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.giveaways TO service_role;
ALTER TABLE public.giveaways ENABLE ROW LEVEL SECURITY;
CREATE INDEX giveaways_guild_idx ON public.giveaways (guild_id);
CREATE INDEX giveaways_due_idx ON public.giveaways (status, ends_at);
CREATE TRIGGER giveaways_updated_at BEFORE UPDATE ON public.giveaways FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();