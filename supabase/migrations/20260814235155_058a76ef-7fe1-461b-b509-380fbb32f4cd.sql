CREATE TABLE public.platform_admins (
  discord_user_id TEXT PRIMARY KEY,
  username TEXT,
  role TEXT NOT NULL DEFAULT 'admin',
  added_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.platform_admins TO service_role;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.platform_users (
  discord_user_id TEXT PRIMARY KEY,
  username TEXT,
  global_name TEXT,
  avatar TEXT,
  email TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  login_count INTEGER NOT NULL DEFAULT 0,
  last_ip TEXT,
  banned BOOLEAN NOT NULL DEFAULT false,
  ban_reason TEXT,
  banned_at TIMESTAMPTZ,
  banned_by TEXT,
  bot_blocked BOOLEAN NOT NULL DEFAULT false,
  plan TEXT NOT NULL DEFAULT 'free',
  feature_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  max_servers INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.platform_users TO service_role;
ALTER TABLE public.platform_users ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER platform_users_updated_at BEFORE UPDATE ON public.platform_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX platform_users_last_seen_idx ON public.platform_users (last_seen_at DESC);

CREATE TABLE public.platform_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  target_type TEXT NOT NULL DEFAULT 'all',
  target_user_id TEXT,
  target_guild_id TEXT,
  via_inbox BOOLEAN NOT NULL DEFAULT true,
  via_dm BOOLEAN NOT NULL DEFAULT false,
  via_announcement BOOLEAN NOT NULL DEFAULT false,
  announcement_channel_id TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  delivery_error TEXT,
  delivered_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.platform_notifications TO service_role;
ALTER TABLE public.platform_notifications ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER platform_notifications_updated_at BEFORE UPDATE ON public.platform_notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX platform_notifications_created_idx ON public.platform_notifications (created_at DESC);

CREATE TABLE public.notification_reads (
  notification_id UUID NOT NULL REFERENCES public.platform_notifications(id) ON DELETE CASCADE,
  discord_user_id TEXT NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, discord_user_id)
);
GRANT ALL ON public.notification_reads TO service_role;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;