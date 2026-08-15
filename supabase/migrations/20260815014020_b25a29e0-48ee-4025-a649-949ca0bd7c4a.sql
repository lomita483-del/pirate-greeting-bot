
-- Shared updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- SERVERS -------------------------------------------------------------
CREATE TABLE public.servers (
  guild_id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Unknown server',
  icon TEXT,
  owner_id TEXT,
  member_count INTEGER NOT NULL DEFAULT 0,
  bot_present BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.servers TO service_role;
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER servers_updated_at BEFORE UPDATE ON public.servers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SERVER SETTINGS -----------------------------------------------------
CREATE TABLE public.server_settings (
  guild_id TEXT PRIMARY KEY REFERENCES public.servers(guild_id) ON DELETE CASCADE,
  prefix TEXT NOT NULL DEFAULT '!',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  locale TEXT NOT NULL DEFAULT 'en',
  currency_name TEXT NOT NULL DEFAULT 'Coins',
  currency_symbol TEXT NOT NULL DEFAULT '🪙',
  xp_enabled BOOLEAN NOT NULL DEFAULT true,
  xp_per_message INTEGER NOT NULL DEFAULT 15 CHECK (xp_per_message BETWEEN 1 AND 500),
  xp_cooldown_seconds INTEGER NOT NULL DEFAULT 60 CHECK (xp_cooldown_seconds BETWEEN 0 AND 3600),
  level_up_message TEXT NOT NULL DEFAULT 'Ahoy {user}, you reached level {level}! ⚓',
  level_up_channel_id TEXT,
  economy_enabled BOOLEAN NOT NULL DEFAULT false,
  daily_reward INTEGER NOT NULL DEFAULT 250 CHECK (daily_reward BETWEEN 0 AND 1000000),
  starting_balance INTEGER NOT NULL DEFAULT 100 CHECK (starting_balance >= 0),
  tickets_enabled BOOLEAN NOT NULL DEFAULT false,
  ticket_panel_channel_id TEXT,
  ticket_category_id TEXT,
  ticket_support_role_ids TEXT[] NOT NULL DEFAULT '{}',
  ticket_welcome_message TEXT NOT NULL DEFAULT 'Ahoy! A crew member will be with you shortly. ⚓',
  ticket_transcripts_enabled BOOLEAN NOT NULL DEFAULT true,
  mod_log_channel_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.server_settings TO service_role;
ALTER TABLE public.server_settings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER server_settings_updated_at BEFORE UPDATE ON public.server_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- MEMBERS -------------------------------------------------------------
CREATE TABLE public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL REFERENCES public.servers(guild_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  username TEXT,
  display_name TEXT,
  avatar TEXT,
  is_bot BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (guild_id, user_id)
);
CREATE INDEX members_guild_idx ON public.members(guild_id);
GRANT ALL ON public.members TO service_role;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER members_updated_at BEFORE UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- WARNINGS ------------------------------------------------------------
CREATE TABLE public.warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL REFERENCES public.servers(guild_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  username TEXT,
  moderator_id TEXT NOT NULL,
  moderator_name TEXT,
  reason TEXT NOT NULL DEFAULT 'No reason provided',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX warnings_guild_user_idx ON public.warnings(guild_id, user_id);
GRANT ALL ON public.warnings TO service_role;
ALTER TABLE public.warnings ENABLE ROW LEVEL SECURITY;

-- MODERATION LOGS -----------------------------------------------------
CREATE TABLE public.moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL REFERENCES public.servers(guild_id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('warn','clear','timeout','untimeout','kick','ban','unban','automod','role_add','role_remove')),
  target_id TEXT,
  target_name TEXT,
  moderator_id TEXT,
  moderator_name TEXT,
  reason TEXT,
  duration_seconds INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX moderation_logs_guild_created_idx ON public.moderation_logs(guild_id, created_at DESC);
GRANT ALL ON public.moderation_logs TO service_role;
ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;

-- TICKETS -------------------------------------------------------------
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL REFERENCES public.servers(guild_id) ON DELETE CASCADE,
  ticket_number INTEGER NOT NULL,
  channel_id TEXT,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general','report','partnership','other')),
  subject TEXT,
  opener_id TEXT NOT NULL,
  opener_name TEXT,
  claimed_by TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','claimed','closed')),
  closed_by TEXT,
  closed_at TIMESTAMPTZ,
  close_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (guild_id, ticket_number)
);
CREATE INDEX tickets_guild_status_idx ON public.tickets(guild_id, status);
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER tickets_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- TICKET MESSAGES -----------------------------------------------------
CREATE TABLE public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  author_name TEXT,
  content TEXT NOT NULL DEFAULT '',
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ticket_messages_ticket_idx ON public.ticket_messages(ticket_id, sent_at);
GRANT ALL ON public.ticket_messages TO service_role;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- XP PROFILES ---------------------------------------------------------
CREATE TABLE public.xp_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL REFERENCES public.servers(guild_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  username TEXT,
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  level INTEGER NOT NULL DEFAULT 0 CHECK (level >= 0),
  messages INTEGER NOT NULL DEFAULT 0,
  last_awarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (guild_id, user_id)
);
CREATE INDEX xp_profiles_leaderboard_idx ON public.xp_profiles(guild_id, xp DESC);
GRANT ALL ON public.xp_profiles TO service_role;
ALTER TABLE public.xp_profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER xp_profiles_updated_at BEFORE UPDATE ON public.xp_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ECONOMY PROFILES ----------------------------------------------------
CREATE TABLE public.economy_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL REFERENCES public.servers(guild_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  username TEXT,
  balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  bank BIGINT NOT NULL DEFAULT 0 CHECK (bank >= 0),
  daily_streak INTEGER NOT NULL DEFAULT 0,
  last_daily_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (guild_id, user_id)
);
CREATE INDEX economy_leaderboard_idx ON public.economy_profiles(guild_id, balance DESC);
GRANT ALL ON public.economy_profiles TO service_role;
ALTER TABLE public.economy_profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER economy_profiles_updated_at BEFORE UPDATE ON public.economy_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- REMINDERS -----------------------------------------------------------
CREATE TABLE public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT,
  channel_id TEXT,
  user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  remind_at TIMESTAMPTZ NOT NULL,
  delivered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reminders_due_idx ON public.reminders(delivered, remind_at);
GRANT ALL ON public.reminders TO service_role;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- CUSTOM COMMANDS -----------------------------------------------------
CREATE TABLE public.custom_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL REFERENCES public.servers(guild_id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (name ~ '^[a-z0-9_-]{1,32}$'),
  response TEXT NOT NULL,
  is_embed BOOLEAN NOT NULL DEFAULT false,
  embed_title TEXT,
  embed_color TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  uses INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (guild_id, name)
);
GRANT ALL ON public.custom_commands TO service_role;
ALTER TABLE public.custom_commands ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER custom_commands_updated_at BEFORE UPDATE ON public.custom_commands FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- AUTOMOD SETTINGS ----------------------------------------------------
CREATE TABLE public.automod_settings (
  guild_id TEXT PRIMARY KEY REFERENCES public.servers(guild_id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  ignored_role_ids TEXT[] NOT NULL DEFAULT '{}',
  ignored_channel_ids TEXT[] NOT NULL DEFAULT '{}',
  anti_spam_enabled BOOLEAN NOT NULL DEFAULT false,
  anti_spam_messages INTEGER NOT NULL DEFAULT 5 CHECK (anti_spam_messages BETWEEN 2 AND 30),
  anti_spam_seconds INTEGER NOT NULL DEFAULT 5 CHECK (anti_spam_seconds BETWEEN 1 AND 120),
  anti_spam_action TEXT NOT NULL DEFAULT 'delete' CHECK (anti_spam_action IN ('delete','warn','timeout')),
  mention_limit_enabled BOOLEAN NOT NULL DEFAULT false,
  mention_limit INTEGER NOT NULL DEFAULT 5 CHECK (mention_limit BETWEEN 1 AND 50),
  mention_action TEXT NOT NULL DEFAULT 'delete' CHECK (mention_action IN ('delete','warn','timeout')),
  invite_filter_enabled BOOLEAN NOT NULL DEFAULT false,
  invite_action TEXT NOT NULL DEFAULT 'delete' CHECK (invite_action IN ('delete','warn','timeout')),
  word_filter_enabled BOOLEAN NOT NULL DEFAULT false,
  blocked_words TEXT[] NOT NULL DEFAULT '{}',
  word_action TEXT NOT NULL DEFAULT 'delete' CHECK (word_action IN ('delete','warn','timeout')),
  duplicate_filter_enabled BOOLEAN NOT NULL DEFAULT false,
  duplicate_action TEXT NOT NULL DEFAULT 'delete' CHECK (duplicate_action IN ('delete','warn','timeout')),
  timeout_seconds INTEGER NOT NULL DEFAULT 300 CHECK (timeout_seconds BETWEEN 60 AND 2419200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.automod_settings TO service_role;
ALTER TABLE public.automod_settings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER automod_settings_updated_at BEFORE UPDATE ON public.automod_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- LOGGING SETTINGS ----------------------------------------------------
CREATE TABLE public.logging_settings (
  guild_id TEXT PRIMARY KEY REFERENCES public.servers(guild_id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  log_channel_id TEXT,
  member_join BOOLEAN NOT NULL DEFAULT true,
  member_leave BOOLEAN NOT NULL DEFAULT true,
  message_delete BOOLEAN NOT NULL DEFAULT true,
  message_edit BOOLEAN NOT NULL DEFAULT true,
  moderation_actions BOOLEAN NOT NULL DEFAULT true,
  role_changes BOOLEAN NOT NULL DEFAULT false,
  channel_changes BOOLEAN NOT NULL DEFAULT false,
  server_changes BOOLEAN NOT NULL DEFAULT false,
  voice_activity BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.logging_settings TO service_role;
ALTER TABLE public.logging_settings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER logging_settings_updated_at BEFORE UPDATE ON public.logging_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- WELCOME SETTINGS ----------------------------------------------------
CREATE TABLE public.welcome_settings (
  guild_id TEXT PRIMARY KEY REFERENCES public.servers(guild_id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  welcome_channel_id TEXT,
  welcome_message TEXT NOT NULL DEFAULT 'Welcome {user} to {server}! ⚓',
  goodbye_enabled BOOLEAN NOT NULL DEFAULT false,
  goodbye_channel_id TEXT,
  goodbye_message TEXT NOT NULL DEFAULT 'Fair winds, {username}. ⚓',
  auto_role_id TEXT,
  use_embed BOOLEAN NOT NULL DEFAULT true,
  embed_color TEXT NOT NULL DEFAULT '#1FB6A6',
  embed_title TEXT NOT NULL DEFAULT 'Ahoy, new crew member!',
  embed_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.welcome_settings TO service_role;
ALTER TABLE public.welcome_settings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER welcome_settings_updated_at BEFORE UPDATE ON public.welcome_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ROLE SETTINGS -------------------------------------------------------
CREATE TABLE public.role_settings (
  guild_id TEXT PRIMARY KEY REFERENCES public.servers(guild_id) ON DELETE CASCADE,
  auto_role_ids TEXT[] NOT NULL DEFAULT '{}',
  level_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
  role_menus JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.role_settings TO service_role;
ALTER TABLE public.role_settings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER role_settings_updated_at BEFORE UPDATE ON public.role_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- DASHBOARD ACCESS LOG ------------------------------------------------
CREATE TABLE public.dashboard_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_user_id TEXT NOT NULL,
  discord_username TEXT,
  guild_id TEXT,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX dashboard_access_log_user_idx ON public.dashboard_access_log(discord_user_id, created_at DESC);
GRANT ALL ON public.dashboard_access_log TO service_role;
ALTER TABLE public.dashboard_access_log ENABLE ROW LEVEL SECURITY;

-- PLATFORM TABLES -----------------------------------------------------
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
