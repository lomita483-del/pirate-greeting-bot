export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          category: string
          channel_id: string | null
          channel_name: string | null
          created_at: string
          guild_id: string
          id: string
          metadata: Json
          summary: string
          target_id: string | null
          target_name: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          category: string
          channel_id?: string | null
          channel_name?: string | null
          created_at?: string
          guild_id: string
          id?: string
          metadata?: Json
          summary?: string
          target_id?: string | null
          target_name?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          category?: string
          channel_id?: string | null
          channel_name?: string | null
          created_at?: string
          guild_id?: string
          id?: string
          metadata?: Json
          summary?: string
          target_id?: string | null
          target_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["guild_id"]
          },
        ]
      }
      automod_settings: {
        Row: {
          anti_spam_action: string
          anti_spam_enabled: boolean
          anti_spam_messages: number
          anti_spam_seconds: number
          blocked_words: string[]
          created_at: string
          duplicate_action: string
          duplicate_filter_enabled: boolean
          enabled: boolean
          guild_id: string
          ignored_channel_ids: string[]
          ignored_role_ids: string[]
          invite_action: string
          invite_filter_enabled: boolean
          mention_action: string
          mention_limit: number
          mention_limit_enabled: boolean
          timeout_seconds: number
          updated_at: string
          word_action: string
          word_filter_enabled: boolean
        }
        Insert: {
          anti_spam_action?: string
          anti_spam_enabled?: boolean
          anti_spam_messages?: number
          anti_spam_seconds?: number
          blocked_words?: string[]
          created_at?: string
          duplicate_action?: string
          duplicate_filter_enabled?: boolean
          enabled?: boolean
          guild_id: string
          ignored_channel_ids?: string[]
          ignored_role_ids?: string[]
          invite_action?: string
          invite_filter_enabled?: boolean
          mention_action?: string
          mention_limit?: number
          mention_limit_enabled?: boolean
          timeout_seconds?: number
          updated_at?: string
          word_action?: string
          word_filter_enabled?: boolean
        }
        Update: {
          anti_spam_action?: string
          anti_spam_enabled?: boolean
          anti_spam_messages?: number
          anti_spam_seconds?: number
          blocked_words?: string[]
          created_at?: string
          duplicate_action?: string
          duplicate_filter_enabled?: boolean
          enabled?: boolean
          guild_id?: string
          ignored_channel_ids?: string[]
          ignored_role_ids?: string[]
          invite_action?: string
          invite_filter_enabled?: boolean
          mention_action?: string
          mention_limit?: number
          mention_limit_enabled?: boolean
          timeout_seconds?: number
          updated_at?: string
          word_action?: string
          word_filter_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "automod_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "servers"
            referencedColumns: ["guild_id"]
          },
        ]
      }
      bot_action_queue: {
        Row: {
          action: string
          created_at: string
          error: string | null
          guild_id: string
          id: string
          payload: Json
          processed_at: string | null
          requested_by: string | null
          requested_by_name: string | null
          status: string
          target_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          error?: string | null
          guild_id: string
          id?: string
          payload?: Json
          processed_at?: string | null
          requested_by?: string | null
          requested_by_name?: string | null
          status?: string
          target_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          error?: string | null
          guild_id?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          requested_by?: string | null
          requested_by_name?: string | null
          status?: string
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_action_queue_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["guild_id"]
          },
        ]
      }
      custom_commands: {
        Row: {
          created_at: string
          created_by: string | null
          embed_color: string | null
          embed_title: string | null
          enabled: boolean
          guild_id: string
          id: string
          is_embed: boolean
          name: string
          response: string
          updated_at: string
          uses: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          embed_color?: string | null
          embed_title?: string | null
          enabled?: boolean
          guild_id: string
          id?: string
          is_embed?: boolean
          name: string
          response: string
          updated_at?: string
          uses?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          embed_color?: string | null
          embed_title?: string | null
          enabled?: boolean
          guild_id?: string
          id?: string
          is_embed?: boolean
          name?: string
          response?: string
          updated_at?: string
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "custom_commands_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["guild_id"]
          },
        ]
      }
      dashboard_access_log: {
        Row: {
          action: string
          created_at: string
          discord_user_id: string
          discord_username: string | null
          guild_id: string | null
          id: string
        }
        Insert: {
          action: string
          created_at?: string
          discord_user_id: string
          discord_username?: string | null
          guild_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          created_at?: string
          discord_user_id?: string
          discord_username?: string | null
          guild_id?: string | null
          id?: string
        }
        Relationships: []
      }
      economy_profiles: {
        Row: {
          balance: number
          bank: number
          created_at: string
          daily_streak: number
          guild_id: string
          id: string
          last_daily_at: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          balance?: number
          bank?: number
          created_at?: string
          daily_streak?: number
          guild_id: string
          id?: string
          last_daily_at?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          balance?: number
          bank?: number
          created_at?: string
          daily_streak?: number
          guild_id?: string
          id?: string
          last_daily_at?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "economy_profiles_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["guild_id"]
          },
        ]
      }
      giveaways: {
        Row: {
          channel_id: string
          created_at: string
          ends_at: string
          guild_id: string
          host_id: string | null
          host_name: string | null
          id: string
          message_id: string | null
          prize: string
          status: string
          updated_at: string
          winner_count: number
          winner_ids: string[]
        }
        Insert: {
          channel_id: string
          created_at?: string
          ends_at: string
          guild_id: string
          host_id?: string | null
          host_name?: string | null
          id?: string
          message_id?: string | null
          prize: string
          status?: string
          updated_at?: string
          winner_count?: number
          winner_ids?: string[]
        }
        Update: {
          channel_id?: string
          created_at?: string
          ends_at?: string
          guild_id?: string
          host_id?: string | null
          host_name?: string | null
          id?: string
          message_id?: string | null
          prize?: string
          status?: string
          updated_at?: string
          winner_count?: number
          winner_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "giveaways_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["guild_id"]
          },
        ]
      }
      logging_settings: {
        Row: {
          channel_changes: boolean
          created_at: string
          enabled: boolean
          guild_id: string
          log_channel_id: string | null
          member_join: boolean
          member_leave: boolean
          message_delete: boolean
          message_edit: boolean
          moderation_actions: boolean
          role_changes: boolean
          server_changes: boolean
          updated_at: string
          voice_activity: boolean
        }
        Insert: {
          channel_changes?: boolean
          created_at?: string
          enabled?: boolean
          guild_id: string
          log_channel_id?: string | null
          member_join?: boolean
          member_leave?: boolean
          message_delete?: boolean
          message_edit?: boolean
          moderation_actions?: boolean
          role_changes?: boolean
          server_changes?: boolean
          updated_at?: string
          voice_activity?: boolean
        }
        Update: {
          channel_changes?: boolean
          created_at?: string
          enabled?: boolean
          guild_id?: string
          log_channel_id?: string | null
          member_join?: boolean
          member_leave?: boolean
          message_delete?: boolean
          message_edit?: boolean
          moderation_actions?: boolean
          role_changes?: boolean
          server_changes?: boolean
          updated_at?: string
          voice_activity?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "logging_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "servers"
            referencedColumns: ["guild_id"]
          },
        ]
      }
      members: {
        Row: {
          avatar: string | null
          created_at: string
          display_name: string | null
          guild_id: string
          id: string
          is_bot: boolean
          joined_at: string | null
          left_at: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          display_name?: string | null
          guild_id: string
          id?: string
          is_bot?: boolean
          joined_at?: string | null
          left_at?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar?: string | null
          created_at?: string
          display_name?: string | null
          guild_id?: string
          id?: string
          is_bot?: boolean
          joined_at?: string | null
          left_at?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["guild_id"]
          },
        ]
      }
      moderation_cases: {
        Row: {
          action: string
          active: boolean
          case_number: number
          created_at: string
          duration_seconds: number | null
          expires_at: string | null
          guild_id: string
          id: string
          metadata: Json
          moderator_id: string | null
          moderator_name: string | null
          reason: string
          target_id: string | null
          target_name: string | null
          updated_at: string
          voided: boolean
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          action: string
          active?: boolean
          case_number: number
          created_at?: string
          duration_seconds?: number | null
          expires_at?: string | null
          guild_id: string
          id?: string
          metadata?: Json
          moderator_id?: string | null
          moderator_name?: string | null
          reason?: string
          target_id?: string | null
          target_name?: string | null
          updated_at?: string
          voided?: boolean
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          action?: string
          active?: boolean
          case_number?: number
          created_at?: string
          duration_seconds?: number | null
          expires_at?: string | null
          guild_id?: string
          id?: string
          metadata?: Json
          moderator_id?: string | null
          moderator_name?: string | null
          reason?: string
          target_id?: string | null
          target_name?: string | null
          updated_at?: string
          voided?: boolean
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_cases_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["guild_id"]
          },
        ]
      }
      moderation_logs: {
        Row: {
          action: string
          created_at: string
          duration_seconds: number | null
          guild_id: string
          id: string
          metadata: Json
          moderator_id: string | null
          moderator_name: string | null
          reason: string | null
          target_id: string | null
          target_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          duration_seconds?: number | null
          guild_id: string
          id?: string
          metadata?: Json
          moderator_id?: string | null
          moderator_name?: string | null
          reason?: string | null
          target_id?: string | null
          target_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          duration_seconds?: number | null
          guild_id?: string
          id?: string
          metadata?: Json
          moderator_id?: string | null
          moderator_name?: string | null
          reason?: string | null
          target_id?: string | null
          target_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_logs_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["guild_id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          discord_user_id: string
          notification_id: string
          read_at: string
        }
        Insert: {
          discord_user_id: string
          notification_id: string
          read_at?: string
        }
        Update: {
          discord_user_id?: string
          notification_id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "platform_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          added_by: string | null
          created_at: string
          discord_user_id: string
          role: string
          username: string | null
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          discord_user_id: string
          role?: string
          username?: string | null
        }
        Update: {
          added_by?: string | null
          created_at?: string
          discord_user_id?: string
          role?: string
          username?: string | null
        }
        Relationships: []
      }
      platform_notifications: {
        Row: {
          announcement_channel_id: string | null
          body: string
          created_at: string
          created_by: string | null
          delivered_at: string | null
          delivery_error: string | null
          delivery_status: string
          id: string
          level: string
          target_guild_id: string | null
          target_type: string
          target_user_id: string | null
          title: string
          updated_at: string
          via_announcement: boolean
          via_dm: boolean
          via_inbox: boolean
        }
        Insert: {
          announcement_channel_id?: string | null
          body: string
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          delivery_error?: string | null
          delivery_status?: string
          id?: string
          level?: string
          target_guild_id?: string | null
          target_type?: string
          target_user_id?: string | null
          title: string
          updated_at?: string
          via_announcement?: boolean
          via_dm?: boolean
          via_inbox?: boolean
        }
        Update: {
          announcement_channel_id?: string | null
          body?: string
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          delivery_error?: string | null
          delivery_status?: string
          id?: string
          level?: string
          target_guild_id?: string | null
          target_type?: string
          target_user_id?: string | null
          title?: string
          updated_at?: string
          via_announcement?: boolean
          via_dm?: boolean
          via_inbox?: boolean
        }
        Relationships: []
      }
      platform_users: {
        Row: {
          avatar: string | null
          ban_reason: string | null
          banned: boolean
          banned_at: string | null
          banned_by: string | null
          bot_blocked: boolean
          created_at: string
          discord_user_id: string
          email: string | null
          feature_flags: Json
          first_seen_at: string
          global_name: string | null
          last_ip: string | null
          last_seen_at: string
          login_count: number
          max_servers: number | null
          notes: string | null
          plan: string
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar?: string | null
          ban_reason?: string | null
          banned?: boolean
          banned_at?: string | null
          banned_by?: string | null
          bot_blocked?: boolean
          created_at?: string
          discord_user_id: string
          email?: string | null
          feature_flags?: Json
          first_seen_at?: string
          global_name?: string | null
          last_ip?: string | null
          last_seen_at?: string
          login_count?: number
          max_servers?: number | null
          notes?: string | null
          plan?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar?: string | null
          ban_reason?: string | null
          banned?: boolean
          banned_at?: string | null
          banned_by?: string | null
          bot_blocked?: boolean
          created_at?: string
          discord_user_id?: string
          email?: string | null
          feature_flags?: Json
          first_seen_at?: string
          global_name?: string | null
          last_ip?: string | null
          last_seen_at?: string
          login_count?: number
          max_servers?: number | null
          notes?: string | null
          plan?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      polls: {
        Row: {
          channel_id: string
          created_at: string
          created_by: string | null
          created_by_name: string | null
          ends_at: string | null
          guild_id: string
          id: string
          message_id: string | null
          multi_choice: boolean
          options: string[]
          question: string
          status: string
          updated_at: string
          votes: Json
        }
        Insert: {
          channel_id: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          ends_at?: string | null
          guild_id: string
          id?: string
          message_id?: string | null
          multi_choice?: boolean
          options?: string[]
          question: string
          status?: string
          updated_at?: string
          votes?: Json
        }
        Update: {
          channel_id?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          ends_at?: string | null
          guild_id?: string
          id?: string
          message_id?: string | null
          multi_choice?: boolean
          options?: string[]
          question?: string
          status?: string
          updated_at?: string
          votes?: Json
        }
        Relationships: [
          {
            foreignKeyName: "polls_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["guild_id"]
          },
        ]
      }
      reaction_roles: {
        Row: {
          channel_id: string
          created_at: string
          created_by: string | null
          description: string | null
          emoji: string
          guild_id: string
          id: string
          message_id: string
          role_id: string
          updated_at: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          emoji: string
          guild_id: string
          id?: string
          message_id: string
          role_id: string
          updated_at?: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          emoji?: string
          guild_id?: string
          id?: string
          message_id?: string
          role_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reaction_roles_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["guild_id"]
          },
        ]
      }
      reminders: {
        Row: {
          channel_id: string | null
          created_at: string
          delivered: boolean
          guild_id: string | null
          id: string
          message: string
          remind_at: string
          user_id: string
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          delivered?: boolean
          guild_id?: string | null
          id?: string
          message: string
          remind_at: string
          user_id: string
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          delivered?: boolean
          guild_id?: string | null
          id?: string
          message?: string
          remind_at?: string
          user_id?: string
        }
        Relationships: []
      }
      role_settings: {
        Row: {
          auto_role_ids: string[]
          created_at: string
          guild_id: string
          level_roles: Json
          role_menus: Json
          updated_at: string
        }
        Insert: {
          auto_role_ids?: string[]
          created_at?: string
          guild_id: string
          level_roles?: Json
          role_menus?: Json
          updated_at?: string
        }
        Update: {
          auto_role_ids?: string[]
          created_at?: string
          guild_id?: string
          level_roles?: Json
          role_menus?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "servers"
            referencedColumns: ["guild_id"]
          },
        ]
      }
      scheduled_announcements: {
        Row: {
          channel_id: string
          created_at: string
          created_by: string | null
          embed_color: string
          embed_title: string | null
          enabled: boolean
          guild_id: string
          id: string
          last_run_at: string | null
          message: string
          name: string
          next_run_at: string
          recurrence: string
          time_of_day: string
          timezone: string
          updated_at: string
          use_embed: boolean
          weekday: number | null
        }
        Insert: {
          channel_id: string
          created_at?: string
          created_by?: string | null
          embed_color?: string
          embed_title?: string | null
          enabled?: boolean
          guild_id: string
          id?: string
          last_run_at?: string | null
          message: string
          name?: string
          next_run_at?: string
          recurrence?: string
          time_of_day?: string
          timezone?: string
          updated_at?: string
          use_embed?: boolean
          weekday?: number | null
        }
        Update: {
          channel_id?: string
          created_at?: string
          created_by?: string | null
          embed_color?: string
          embed_title?: string | null
          enabled?: boolean
          guild_id?: string
          id?: string
          last_run_at?: string | null
          message?: string
          name?: string
          next_run_at?: string
          recurrence?: string
          time_of_day?: string
          timezone?: string
          updated_at?: string
          use_embed?: boolean
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_announcements_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["guild_id"]
          },
        ]
      }
      server_settings: {
        Row: {
          created_at: string
          currency_name: string
          currency_symbol: string
          daily_reward: number
          economy_enabled: boolean
          guild_id: string
          level_up_channel_id: string | null
          level_up_message: string
          locale: string
          mod_log_channel_id: string | null
          prefix: string
          starting_balance: number
          ticket_category_id: string | null
          ticket_panel_channel_id: string | null
          ticket_support_role_ids: string[]
          ticket_transcripts_enabled: boolean
          ticket_welcome_message: string
          tickets_enabled: boolean
          timezone: string
          updated_at: string
          xp_cooldown_seconds: number
          xp_enabled: boolean
          xp_per_message: number
        }
        Insert: {
          created_at?: string
          currency_name?: string
          currency_symbol?: string
          daily_reward?: number
          economy_enabled?: boolean
          guild_id: string
          level_up_channel_id?: string | null
          level_up_message?: string
          locale?: string
          mod_log_channel_id?: string | null
          prefix?: string
          starting_balance?: number
          ticket_category_id?: string | null
          ticket_panel_channel_id?: string | null
          ticket_support_role_ids?: string[]
          ticket_transcripts_enabled?: boolean
          ticket_welcome_message?: string
          tickets_enabled?: boolean
          timezone?: string
          updated_at?: string
          xp_cooldown_seconds?: number
          xp_enabled?: boolean
          xp_per_message?: number
        }
        Update: {
          created_at?: string
          currency_name?: string
          currency_symbol?: string
          daily_reward?: number
          economy_enabled?: boolean
          guild_id?: string
          level_up_channel_id?: string | null
          level_up_message?: string
          locale?: string
          mod_log_channel_id?: string | null
          prefix?: string
          starting_balance?: number
          ticket_category_id?: string | null
          ticket_panel_channel_id?: string | null
          ticket_support_role_ids?: string[]
          ticket_transcripts_enabled?: boolean
          ticket_welcome_message?: string
          tickets_enabled?: boolean
          timezone?: string
          updated_at?: string
          xp_cooldown_seconds?: number
          xp_enabled?: boolean
          xp_per_message?: number
        }
        Relationships: [
          {
            foreignKeyName: "server_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "servers"
            referencedColumns: ["guild_id"]
          },
        ]
      }
      servers: {
        Row: {
          bot_present: boolean
          created_at: string
          guild_id: string
          icon: string | null
          joined_at: string
          member_count: number
          name: string
          owner_id: string | null
          updated_at: string
        }
        Insert: {
          bot_present?: boolean
          created_at?: string
          guild_id: string
          icon?: string | null
          joined_at?: string
          member_count?: number
          name?: string
          owner_id?: string | null
          updated_at?: string
        }
        Update: {
          bot_present?: boolean
          created_at?: string
          guild_id?: string
          icon?: string | null
          joined_at?: string
          member_count?: number
          name?: string
          owner_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      starboard_entries: {
        Row: {
          author_id: string | null
          author_name: string | null
          created_at: string
          guild_id: string
          id: string
          source_channel_id: string
          source_message_id: string
          star_count: number
          starboard_message_id: string | null
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          created_at?: string
          guild_id: string
          id?: string
          source_channel_id: string
          source_message_id: string
          star_count?: number
          starboard_message_id?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          created_at?: string
          guild_id?: string
          id?: string
          source_channel_id?: string
          source_message_id?: string
          star_count?: number
          starboard_message_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "starboard_entries_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["guild_id"]
          },
        ]
      }
      starboard_settings: {
        Row: {
          allow_self_star: boolean
          channel_id: string | null
          created_at: string
          emoji: string
          enabled: boolean
          guild_id: string
          ignored_channel_ids: string[]
          threshold: number
          updated_at: string
        }
        Insert: {
          allow_self_star?: boolean
          channel_id?: string | null
          created_at?: string
          emoji?: string
          enabled?: boolean
          guild_id: string
          ignored_channel_ids?: string[]
          threshold?: number
          updated_at?: string
        }
        Update: {
          allow_self_star?: boolean
          channel_id?: string | null
          created_at?: string
          emoji?: string
          enabled?: boolean
          guild_id?: string
          ignored_channel_ids?: string[]
          threshold?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "starboard_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "servers"
            referencedColumns: ["guild_id"]
          },
        ]
      }
      stat_channels: {
        Row: {
          channel_id: string
          created_at: string
          created_by: string | null
          enabled: boolean
          guild_id: string
          id: string
          kind: string
          last_updated_at: string | null
          last_value: number | null
          name_template: string
          updated_at: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          guild_id: string
          id?: string
          kind?: string
          last_updated_at?: string | null
          last_value?: number | null
          name_template?: string
          updated_at?: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          guild_id?: string
          id?: string
          kind?: string
          last_updated_at?: string | null
          last_value?: number | null
          name_template?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stat_channels_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["guild_id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          attachments: Json
          author_id: string
          author_name: string | null
          content: string
          id: string
          sent_at: string
          ticket_id: string
        }
        Insert: {
          attachments?: Json
          author_id: string
          author_name?: string | null
          content?: string
          id?: string
          sent_at?: string
          ticket_id: string
        }
        Update: {
          attachments?: Json
          author_id?: string
          author_name?: string | null
          content?: string
          id?: string
          sent_at?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          category: string
          channel_id: string | null
          claimed_by: string | null
          close_reason: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          guild_id: string
          id: string
          opener_id: string
          opener_name: string | null
          status: string
          subject: string | null
          ticket_number: number
          updated_at: string
        }
        Insert: {
          category?: string
          channel_id?: string | null
          claimed_by?: string | null
          close_reason?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          guild_id: string
          id?: string
          opener_id: string
          opener_name?: string | null
          status?: string
          subject?: string | null
          ticket_number: number
          updated_at?: string
        }
        Update: {
          category?: string
          channel_id?: string | null
          claimed_by?: string | null
          close_reason?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          guild_id?: string
          id?: string
          opener_id?: string
          opener_name?: string | null
          status?: string
          subject?: string | null
          ticket_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["guild_id"]
          },
        ]
      }
      voice_stats: {
        Row: {
          created_at: string
          guild_id: string
          id: string
          last_joined_at: string | null
          last_left_at: string | null
          sessions: number
          updated_at: string
          user_id: string
          username: string | null
          voice_seconds: number
        }
        Insert: {
          created_at?: string
          guild_id: string
          id?: string
          last_joined_at?: string | null
          last_left_at?: string | null
          sessions?: number
          updated_at?: string
          user_id: string
          username?: string | null
          voice_seconds?: number
        }
        Update: {
          created_at?: string
          guild_id?: string
          id?: string
          last_joined_at?: string | null
          last_left_at?: string | null
          sessions?: number
          updated_at?: string
          user_id?: string
          username?: string | null
          voice_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "voice_stats_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["guild_id"]
          },
        ]
      }
      warnings: {
        Row: {
          active: boolean
          created_at: string
          guild_id: string
          id: string
          moderator_id: string
          moderator_name: string | null
          reason: string
          user_id: string
          username: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          guild_id: string
          id?: string
          moderator_id: string
          moderator_name?: string | null
          reason?: string
          user_id: string
          username?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          guild_id?: string
          id?: string
          moderator_id?: string
          moderator_name?: string | null
          reason?: string
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warnings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["guild_id"]
          },
        ]
      }
      welcome_settings: {
        Row: {
          auto_role_id: string | null
          created_at: string
          embed_color: string
          embed_image_url: string | null
          embed_title: string
          enabled: boolean
          goodbye_channel_id: string | null
          goodbye_enabled: boolean
          goodbye_message: string
          guild_id: string
          updated_at: string
          use_embed: boolean
          welcome_channel_id: string | null
          welcome_message: string
        }
        Insert: {
          auto_role_id?: string | null
          created_at?: string
          embed_color?: string
          embed_image_url?: string | null
          embed_title?: string
          enabled?: boolean
          goodbye_channel_id?: string | null
          goodbye_enabled?: boolean
          goodbye_message?: string
          guild_id: string
          updated_at?: string
          use_embed?: boolean
          welcome_channel_id?: string | null
          welcome_message?: string
        }
        Update: {
          auto_role_id?: string | null
          created_at?: string
          embed_color?: string
          embed_image_url?: string | null
          embed_title?: string
          enabled?: boolean
          goodbye_channel_id?: string | null
          goodbye_enabled?: boolean
          goodbye_message?: string
          guild_id?: string
          updated_at?: string
          use_embed?: boolean
          welcome_channel_id?: string | null
          welcome_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "welcome_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "servers"
            referencedColumns: ["guild_id"]
          },
        ]
      }
      xp_profiles: {
        Row: {
          created_at: string
          guild_id: string
          id: string
          last_awarded_at: string | null
          level: number
          messages: number
          updated_at: string
          user_id: string
          username: string | null
          xp: number
        }
        Insert: {
          created_at?: string
          guild_id: string
          id?: string
          last_awarded_at?: string | null
          level?: number
          messages?: number
          updated_at?: string
          user_id: string
          username?: string | null
          xp?: number
        }
        Update: {
          created_at?: string
          guild_id?: string
          id?: string
          last_awarded_at?: string | null
          level?: number
          messages?: number
          updated_at?: string
          user_id?: string
          username?: string | null
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "xp_profiles_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["guild_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      next_case_number: { Args: { _guild_id: string }; Returns: number }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
