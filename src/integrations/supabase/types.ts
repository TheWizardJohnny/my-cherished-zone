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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          active: boolean | null
          content: string
          created_at: string
          id: string
          priority: string | null
          title: string
        }
        Insert: {
          active?: boolean | null
          content: string
          created_at?: string
          id?: string
          priority?: string | null
          title: string
        }
        Update: {
          active?: boolean | null
          content?: string
          created_at?: string
          id?: string
          priority?: string | null
          title?: string
        }
        Relationships: []
      }
      commissions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          order_id: string | null
          paid_at: string | null
          source_user_id: string | null
          status: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          paid_at?: string | null
          source_user_id?: string | null
          status?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          paid_at?: string | null
          source_user_id?: string | null
          status?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_source_user_id_fkey"
            columns: ["source_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          contact_number: string | null
          created_at: string
          delivery_address: Json | null
          id: string
          payment_reference: string | null
          payment_status: string | null
          product_id: string
          pv_earned: number
          quantity: number
          total_amount: number
          tx_id: string | null
          tx_verification_details: Json | null
          tx_verification_status: string | null
          tx_verified_at: string | null
          user_id: string
        }
        Insert: {
          contact_number?: string | null
          created_at?: string
          delivery_address?: Json | null
          id?: string
          payment_reference?: string | null
          payment_status?: string | null
          product_id: string
          pv_earned: number
          quantity?: number
          total_amount: number
          tx_id?: string | null
          tx_verification_details?: Json | null
          tx_verification_status?: string | null
          tx_verified_at?: string | null
          user_id: string
        }
        Update: {
          contact_number?: string | null
          created_at?: string
          delivery_address?: Json | null
          id?: string
          payment_reference?: string | null
          payment_status?: string | null
          product_id?: string
          pv_earned?: number
          quantity?: number
          total_amount?: number
          tx_id?: string | null
          tx_verification_details?: Json | null
          tx_verification_status?: string | null
          tx_verified_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          price: number
          pv_value: number
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price: number
          pv_value?: number
        }
        Update: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          pv_value?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          personal_volume: number | null
          phone: string | null
          placement_id: string | null
          placement_side: string | null
          rank: string | null
          referral_id: string | null
          sponsor_id: string | null
          status: string | null
          total_left_volume: number | null
          total_right_volume: number | null
          updated_at: string
          user_id: string
          wallet_address: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          personal_volume?: number | null
          phone?: string | null
          placement_id?: string | null
          placement_side?: string | null
          rank?: string | null
          referral_id?: string | null
          sponsor_id?: string | null
          status?: string | null
          total_left_volume?: number | null
          total_right_volume?: number | null
          updated_at?: string
          user_id: string
          wallet_address?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          personal_volume?: number | null
          phone?: string | null
          placement_id?: string | null
          placement_side?: string | null
          rank?: string | null
          referral_id?: string | null
          sponsor_id?: string | null
          status?: string | null
          total_left_volume?: number | null
          total_right_volume?: number | null
          updated_at?: string
          user_id?: string
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          id: string
          key: string
          value: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          key: string
          value: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          key?: string
          value?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      placements: {
        Row: {
          created_at: string
          id: string
          position: string | null
          status: string
          updated_at: string
          upline_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          position?: string | null
          status?: string
          updated_at?: string
          upline_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: string | null
          status?: string
          updated_at?: string
          upline_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "placements_upline_id_fkey"
            columns: ["upline_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referred_user_id: string
          referrer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          referred_user_id: string
          referrer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          referred_user_id?: string
          referrer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          amount: number
          created_at: string
          id: string
          processed_at: string | null
          status: string | null
          transaction_hash: string | null
          user_id: string
          wallet_address: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          processed_at?: string | null
          status?: string | null
          transaction_hash?: string | null
          user_id: string
          wallet_address: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          processed_at?: string | null
          status?: string | null
          transaction_hash?: string | null
          user_id?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_pools: {
        Row: {
          id: string
          week_start: string
          week_end: string
          total_contributions: number
          recycled_in: number
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          week_start: string
          week_end: string
          total_contributions?: number
          recycled_in?: number
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          week_start?: string
          week_end?: string
          total_contributions?: number
          recycled_in?: number
          status?: string
          created_at?: string
        }
        Relationships: []
      }
      weekly_pool_contributions: {
        Row: {
          id: string
          pool_id: string
          order_id: string
          buyer_id: string
          amount: number
          created_at: string
        }
        Insert: {
          id?: string
          pool_id: string
          order_id: string
          buyer_id: string
          amount: number
          created_at?: string
        }
        Update: {
          id?: string
          pool_id?: string
          order_id?: string
          buyer_id?: string
          amount?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_pool_contributions_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "weekly_pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_pool_contributions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_pool_contributions_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_user_pv: {
        Row: {
          id: string
          pool_id: string
          user_id: string
          left_pv: number
          right_pv: number
          carryover_left_in: number
          carryover_right_in: number
          matched_pv: number
          carryover_left_out: number
          carryover_right_out: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          pool_id: string
          user_id: string
          left_pv?: number
          right_pv?: number
          carryover_left_in?: number
          carryover_right_in?: number
          matched_pv?: number
          carryover_left_out?: number
          carryover_right_out?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          pool_id?: string
          user_id?: string
          left_pv?: number
          right_pv?: number
          carryover_left_in?: number
          carryover_right_in?: number
          matched_pv?: number
          carryover_left_out?: number
          carryover_right_out?: number
          is_active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_user_pv_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "weekly_pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_user_pv_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_binary_commission: {
        Args: { p_commission_id: string }
        Returns: void
      }
      bulk_approve_binary_commissions: {
        Args: { p_pool_id: string }
        Returns: number
      }
      bulk_pay_binary_commissions: {
        Args: { p_pool_id: string }
        Returns: number
      }
      compute_weekly_user_pv: {
        Args: { p_pool_id: string }
        Returns: void
      }
      distribute_weekly_binary_pool: {
        Args: { p_pool_id: string }
        Returns: void
      }
      ensure_weekly_pool: {
        Args: { p_ts: string }
        Returns: string
      }
      get_own_profile_id: { Args: never; Returns: string }
      get_placement_side_relative_to_referrer: {
        Args: {
          p_user_id: string
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      pay_binary_commission: {
        Args: { p_commission_id: string }
        Returns: void
      }
      place_user_in_binary_tree: {
        Args: {
          user_profile_id: string
          referrer_profile_id: string
          placement_strategy: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
