export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_permission_changes: {
        Row: {
          affected_delegation: string | null
          affected_role: string | null
          affected_user: string | null
          after_state: Json | null
          approved_at: string | null
          approved_by: string | null
          before_state: Json | null
          change_type: string
          changed_by: string
          id: string
          justification: string | null
          requires_approval: boolean | null
          timestamp: string | null
        }
        Insert: {
          affected_delegation?: string | null
          affected_role?: string | null
          affected_user?: string | null
          after_state?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          before_state?: Json | null
          change_type: string
          changed_by: string
          id?: string
          justification?: string | null
          requires_approval?: boolean | null
          timestamp?: string | null
        }
        Update: {
          affected_delegation?: string | null
          affected_role?: string | null
          affected_user?: string | null
          after_state?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          before_state?: Json | null
          change_type?: string
          changed_by?: string
          id?: string
          justification?: string | null
          requires_approval?: boolean | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_permission_changes_affected_delegation_fkey"
            columns: ["affected_delegation"]
            isOneToOne: false
            referencedRelation: "delegations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_permission_changes_affected_role_fkey"
            columns: ["affected_role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_permission_checks: {
        Row: {
          action: string
          allowed: boolean
          cache_hit: boolean | null
          delegations: string[] | null
          denial_reason: string | null
          emergency_override: string | null
          evaluation_time_ms: number | null
          id: string
          ip_address: unknown | null
          resource_id: string | null
          resource_type: string
          session_id: string | null
          timestamp: string | null
          user_agent: string | null
          user_id: string | null
          user_roles: string[] | null
        }
        Insert: {
          action: string
          allowed: boolean
          cache_hit?: boolean | null
          delegations?: string[] | null
          denial_reason?: string | null
          emergency_override?: string | null
          evaluation_time_ms?: number | null
          id?: string
          ip_address?: unknown | null
          resource_id?: string | null
          resource_type: string
          session_id?: string | null
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string | null
          user_roles?: string[] | null
        }
        Update: {
          action?: string
          allowed?: boolean
          cache_hit?: boolean | null
          delegations?: string[] | null
          denial_reason?: string | null
          emergency_override?: string | null
          evaluation_time_ms?: number | null
          id?: string
          ip_address?: unknown | null
          resource_id?: string | null
          resource_type?: string
          session_id?: string | null
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string | null
          user_roles?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_permission_checks_emergency_override_fkey"
            columns: ["emergency_override"]
            isOneToOne: false
            referencedRelation: "emergency_overrides"
            referencedColumns: ["id"]
          },
        ]
      }
      delegation_permissions: {
        Row: {
          delegation_id: string
          permission_id: string
        }
        Insert: {
          delegation_id: string
          permission_id: string
        }
        Update: {
          delegation_id?: string
          permission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delegation_permissions_delegation_id_fkey"
            columns: ["delegation_id"]
            isOneToOne: false
            referencedRelation: "delegations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delegation_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      delegation_scopes: {
        Row: {
          created_at: string | null
          delegation_id: string | null
          entity_id: string
          entity_type: string
          id: string
          scope_type: string
        }
        Insert: {
          created_at?: string | null
          delegation_id?: string | null
          entity_id: string
          entity_type: string
          id?: string
          scope_type: string
        }
        Update: {
          created_at?: string | null
          delegation_id?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          scope_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "delegation_scopes_delegation_id_fkey"
            columns: ["delegation_id"]
            isOneToOne: false
            referencedRelation: "delegations"
            referencedColumns: ["id"]
          },
        ]
      }
      delegations: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          from_user_id: string
          id: string
          reason: string
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          role_id: string | null
          state: string
          to_user_id: string
          valid_from: string
          valid_until: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          from_user_id: string
          id?: string
          reason: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role_id?: string | null
          state?: string
          to_user_id: string
          valid_from: string
          valid_until: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          from_user_id?: string
          id?: string
          reason?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role_id?: string | null
          state?: string
          to_user_id?: string
          valid_from?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "delegations_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_overrides: {
        Row: {
          activated_at: string | null
          affected_user: string
          deactivated_at: string | null
          deactivated_by: string | null
          duration_minutes: number
          expires_at: string | null
          granted_permissions: string[]
          id: string
          justification: string
          notified_users: string[]
          reason: string
          triggered_by: string
        }
        Insert: {
          activated_at?: string | null
          affected_user: string
          deactivated_at?: string | null
          deactivated_by?: string | null
          duration_minutes?: number
          expires_at?: string | null
          granted_permissions: string[]
          id?: string
          justification: string
          notified_users: string[]
          reason: string
          triggered_by: string
        }
        Update: {
          activated_at?: string | null
          affected_user?: string
          deactivated_at?: string | null
          deactivated_by?: string | null
          duration_minutes?: number
          expires_at?: string | null
          granted_permissions?: string[]
          id?: string
          justification?: string
          notified_users?: string[]
          reason?: string
          triggered_by?: string
        }
        Relationships: []
      }
      permission_set_hierarchy: {
        Row: {
          ancestor_id: string
          depth: number
          descendant_id: string
        }
        Insert: {
          ancestor_id: string
          depth: number
          descendant_id: string
        }
        Update: {
          ancestor_id?: string
          depth?: number
          descendant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_set_hierarchy_ancestor_id_fkey"
            columns: ["ancestor_id"]
            isOneToOne: false
            referencedRelation: "permission_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_set_hierarchy_descendant_id_fkey"
            columns: ["descendant_id"]
            isOneToOne: false
            referencedRelation: "permission_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_set_permissions: {
        Row: {
          permission_id: string
          permission_set_id: string
        }
        Insert: {
          permission_id: string
          permission_set_id: string
        }
        Update: {
          permission_id?: string
          permission_set_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_set_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_set_permissions_permission_set_id_fkey"
            columns: ["permission_set_id"]
            isOneToOne: false
            referencedRelation: "permission_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_sets: {
        Row: {
          created_at: string | null
          description: string
          id: string
          name: string
          parent_set_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          name: string
          parent_set_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          name?: string
          parent_set_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "permission_sets_parent_set_id_fkey"
            columns: ["parent_set_id"]
            isOneToOne: false
            referencedRelation: "permission_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          created_at: string | null
          description: string | null
          effect: string
          id: string
          resource: string
          scope: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          description?: string | null
          effect?: string
          id?: string
          resource: string
          scope?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          description?: string | null
          effect?: string
          id?: string
          resource?: string
          scope?: string | null
        }
        Relationships: []
      }
      recurring_schedules: {
        Row: {
          created_at: string | null
          days_of_week: number[]
          id: string
          time_end: string
          time_start: string
          timezone: string
          user_role_id: string | null
        }
        Insert: {
          created_at?: string | null
          days_of_week: number[]
          id?: string
          time_end: string
          time_start: string
          timezone: string
          user_role_id?: string | null
        }
        Update: {
          created_at?: string | null
          days_of_week?: number[]
          id?: string
          time_end?: string
          time_start?: string
          timezone?: string
          user_role_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_schedules_user_role_id_fkey"
            columns: ["user_role_id"]
            isOneToOne: true
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permission_sets: {
        Row: {
          permission_set_id: string
          role_id: string
        }
        Insert: {
          permission_set_id: string
          role_id: string
        }
        Update: {
          permission_set_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permission_sets_permission_set_id_fkey"
            columns: ["permission_set_id"]
            isOneToOne: false
            referencedRelation: "permission_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permission_sets_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string
          id: string
          is_system: boolean | null
          name: string
          priority: number
          state: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          is_system?: boolean | null
          name: string
          priority?: number
          state?: string
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          is_system?: boolean | null
          name?: string
          priority?: number
          state?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_role_scopes: {
        Row: {
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          scope_type: string
          user_role_id: string | null
        }
        Insert: {
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          scope_type: string
          user_role_id?: string | null
        }
        Update: {
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          scope_type?: string
          user_role_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_role_scopes_user_role_id_fkey"
            columns: ["user_role_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          granted_by: string | null
          id: string
          reason: string | null
          reminder_days_before: number | null
          reminder_sent_at: string | null
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          role_id: string | null
          state: string
          state_changed_at: string | null
          state_changed_by: string | null
          user_id: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          assigned_at?: string | null
          granted_by?: string | null
          id?: string
          reason?: string | null
          reminder_days_before?: number | null
          reminder_sent_at?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role_id?: string | null
          state?: string
          state_changed_at?: string | null
          state_changed_by?: string | null
          user_id: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          assigned_at?: string | null
          granted_by?: string | null
          id?: string
          reason?: string | null
          reminder_days_before?: number | null
          reminder_sent_at?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role_id?: string | null
          state?: string
          state_changed_at?: string | null
          state_changed_by?: string | null
          user_id?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      user_permissions: {
        Row: {
          action: string | null
          effect: string | null
          resource: string | null
          role_id: string | null
          role_type: string | null
          scope: string | null
          scoped_to_entity: string | null
          source: string | null
          user_id: string | null
          valid_until: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_permission_set_inheritance: {
        Args: { parent_set_id: string; child_set_id: string }
        Returns: undefined
      }
      refresh_user_permissions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
