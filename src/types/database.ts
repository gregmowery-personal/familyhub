export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      families: {
        Row: {
          id: string
          name: string
          family_type: 'nuclear' | 'single_parent' | 'blended' | 'multigenerational' | 'extended'
          timezone: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          name: string
          family_type?: 'nuclear' | 'single_parent' | 'blended' | 'multigenerational' | 'extended'
          timezone?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          family_type?: 'nuclear' | 'single_parent' | 'blended' | 'multigenerational' | 'extended'
          timezone?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      family_members: {
        Row: {
          id: string
          family_id: string
          user_id: string
          role: 'admin' | 'adult' | 'teen' | 'child' | 'senior'
          relationship: string | null
          birth_date: string | null
          is_primary_contact: boolean
          is_emergency_contact: boolean
          is_family_admin: boolean
          access_level: 'full' | 'limited' | 'view_only'
          interface_preference: 'full' | 'simplified' | 'child_friendly'
          custody_schedule: Json | null
          custody_percentage: number | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          family_id: string
          user_id: string
          role?: 'admin' | 'adult' | 'teen' | 'child' | 'senior'
          relationship?: string | null
          birth_date?: string | null
          is_primary_contact?: boolean
          is_emergency_contact?: boolean
          is_family_admin?: boolean
          access_level?: 'full' | 'limited' | 'view_only'
          interface_preference?: 'full' | 'simplified' | 'child_friendly'
          custody_schedule?: Json | null
          custody_percentage?: number | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          family_id?: string
          user_id?: string
          role?: 'admin' | 'adult' | 'teen' | 'child' | 'senior'
          relationship?: string | null
          birth_date?: string | null
          is_primary_contact?: boolean
          is_emergency_contact?: boolean
          is_family_admin?: boolean
          access_level?: 'full' | 'limited' | 'view_only'
          interface_preference?: 'full' | 'simplified' | 'child_friendly'
          custody_schedule?: Json | null
          custody_percentage?: number | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      user_profiles: {
        Row: {
          id: string
          first_name: string | null
          last_name: string | null
          display_name: string | null
          phone_number: string | null
          profile_image_url: string | null
          preferred_language: string
          timezone: string
          notification_preferences: Json
          accessibility_preferences: Json
          two_factor_enabled: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id: string
          first_name?: string | null
          last_name?: string | null
          display_name?: string | null
          phone_number?: string | null
          profile_image_url?: string | null
          preferred_language?: string
          timezone?: string
          notification_preferences?: Json
          accessibility_preferences?: Json
          two_factor_enabled?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          first_name?: string | null
          last_name?: string | null
          display_name?: string | null
          phone_number?: string | null
          profile_image_url?: string | null
          preferred_language?: string
          timezone?: string
          notification_preferences?: Json
          accessibility_preferences?: Json
          two_factor_enabled?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      user_sessions: {
        Row: {
          id: string
          user_id: string
          family_id: string | null
          session_token: string
          device_id: string | null
          device_name: string | null
          device_type: string | null
          platform: string | null
          browser_name: string | null
          ip_address: string | null
          country: string | null
          city: string | null
          user_agent: string | null
          created_at: string
          last_activity_at: string
          expires_at: string
          is_active: boolean
          is_trusted_device: boolean
          active_family_role: 'admin' | 'adult' | 'teen' | 'child' | 'senior' | null
        }
        Insert: {
          id?: string
          user_id: string
          family_id?: string | null
          session_token: string
          device_id?: string | null
          device_name?: string | null
          device_type?: string | null
          platform?: string | null
          browser_name?: string | null
          ip_address?: string | null
          country?: string | null
          city?: string | null
          user_agent?: string | null
          created_at?: string
          last_activity_at?: string
          expires_at: string
          is_active?: boolean
          is_trusted_device?: boolean
          active_family_role?: 'admin' | 'adult' | 'teen' | 'child' | 'senior' | null
        }
        Update: {
          id?: string
          user_id?: string
          family_id?: string | null
          session_token?: string
          device_id?: string | null
          device_name?: string | null
          device_type?: string | null
          platform?: string | null
          browser_name?: string | null
          ip_address?: string | null
          country?: string | null
          city?: string | null
          user_agent?: string | null
          created_at?: string
          last_activity_at?: string
          expires_at?: string
          is_active?: boolean
          is_trusted_device?: boolean
          active_family_role?: 'admin' | 'adult' | 'teen' | 'child' | 'senior' | null
        }
      }
      auth_tokens: {
        Row: {
          id: string
          token_hash: string
          token_type: 'password_reset' | 'email_verification' | 'family_invitation' | 'magic_link' | 'mfa_backup' | 'account_verification' | 'session_challenge'
          token_status: 'active' | 'used' | 'expired' | 'revoked'
          user_id: string | null
          email: string | null
          family_id: string | null
          expires_at: string
          max_uses: number
          uses_count: number
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          token_hash: string
          token_type: 'password_reset' | 'email_verification' | 'family_invitation' | 'magic_link' | 'mfa_backup' | 'account_verification' | 'session_challenge'
          token_status?: 'active' | 'used' | 'expired' | 'revoked'
          user_id?: string | null
          email?: string | null
          family_id?: string | null
          expires_at: string
          max_uses?: number
          uses_count?: number
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          token_hash?: string
          token_type?: 'password_reset' | 'email_verification' | 'family_invitation' | 'magic_link' | 'mfa_backup' | 'account_verification' | 'session_challenge'
          token_status?: 'active' | 'used' | 'expired' | 'revoked'
          user_id?: string | null
          email?: string | null
          family_id?: string | null
          expires_at?: string
          max_uses?: number
          uses_count?: number
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      social_auth_providers: {
        Row: {
          id: string
          user_id: string
          provider: 'google' | 'apple' | 'facebook' | 'microsoft' | 'github' | 'twitter' | 'linkedin'
          provider_user_id: string
          provider_username: string | null
          provider_email: string | null
          provider_data: Json | null
          display_name: string | null
          avatar_url: string | null
          link_status: 'active' | 'inactive' | 'pending' | 'error'
          linked_at: string
          last_used_at: string | null
          is_primary_provider: boolean
          auto_login_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          provider: 'google' | 'apple' | 'facebook' | 'microsoft' | 'github' | 'twitter' | 'linkedin'
          provider_user_id: string
          provider_username?: string | null
          provider_email?: string | null
          provider_data?: Json | null
          display_name?: string | null
          avatar_url?: string | null
          link_status?: 'active' | 'inactive' | 'pending' | 'error'
          linked_at?: string
          last_used_at?: string | null
          is_primary_provider?: boolean
          auto_login_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          provider?: 'google' | 'apple' | 'facebook' | 'microsoft' | 'github' | 'twitter' | 'linkedin'
          provider_user_id?: string
          provider_username?: string | null
          provider_email?: string | null
          provider_data?: Json | null
          display_name?: string | null
          avatar_url?: string | null
          link_status?: 'active' | 'inactive' | 'pending' | 'error'
          linked_at?: string
          last_used_at?: string | null
          is_primary_provider?: boolean
          auto_login_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      auth_audit_log: {
        Row: {
          id: string
          event_type: string
          event_category: string
          severity: 'low' | 'medium' | 'high' | 'critical'
          actor_user_id: string | null
          actor_type: string
          actor_ip_address: string | null
          actor_user_agent: string | null
          target_user_id: string | null
          target_family_id: string | null
          event_description: string
          event_data: Json | null
          success: boolean
          risk_score: number | null
          is_anomalous: boolean
          retention_period: string
          occurred_at: string
        }
        Insert: {
          id?: string
          event_type: string
          event_category: string
          severity?: 'low' | 'medium' | 'high' | 'critical'
          actor_user_id?: string | null
          actor_type?: string
          actor_ip_address?: string | null
          actor_user_agent?: string | null
          target_user_id?: string | null
          target_family_id?: string | null
          event_description: string
          event_data?: Json | null
          success?: boolean
          risk_score?: number | null
          is_anomalous?: boolean
          retention_period?: string
          occurred_at?: string
        }
        Update: {
          id?: string
          event_type?: string
          event_category?: string
          severity?: 'low' | 'medium' | 'high' | 'critical'
          actor_user_id?: string | null
          actor_type?: string
          actor_ip_address?: string | null
          actor_user_agent?: string | null
          target_user_id?: string | null
          target_family_id?: string | null
          event_description?: string
          event_data?: Json | null
          success?: boolean
          risk_score?: number | null
          is_anomalous?: boolean
          retention_period?: string
          occurred_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_family_admin: {
        Args: {
          user_id: string
          family_id: string
        }
        Returns: boolean
      }
      get_user_families: {
        Args: {
          user_id: string
        }
        Returns: {
          id: string
          name: string
          family_type: string
          timezone: string
          role: string
          is_family_admin: boolean
        }[]
      }
      create_user_session: {
        Args: {
          user_id: string
          session_token: string
          device_info?: Json
          ip_address?: string
          user_agent?: string
        }
        Returns: string
      }
      log_audit_event: {
        Args: {
          event_type: string
          event_category: string
          event_description: string
          actor_user_id?: string
          target_user_id?: string
          target_family_id?: string
          event_data?: Json
          severity?: 'low' | 'medium' | 'high' | 'critical'
          success?: boolean
        }
        Returns: void
      }
    }
    Enums: {
      family_type: 'nuclear' | 'single_parent' | 'blended' | 'multigenerational' | 'extended'
      user_role_type: 'admin' | 'adult' | 'teen' | 'child' | 'senior'
      access_level: 'full' | 'limited' | 'view_only'
      interface_complexity: 'full' | 'simplified' | 'child_friendly'
      token_type: 'password_reset' | 'email_verification' | 'family_invitation' | 'magic_link' | 'mfa_backup' | 'account_verification' | 'session_challenge'
      token_status: 'active' | 'used' | 'expired' | 'revoked'
      social_provider_type: 'google' | 'apple' | 'facebook' | 'microsoft' | 'github' | 'twitter' | 'linkedin'
      link_status: 'active' | 'inactive' | 'pending' | 'error'
      audit_severity: 'low' | 'medium' | 'high' | 'critical'
    }
  }
}