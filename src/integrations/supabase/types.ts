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
      [_ in never]: never
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
