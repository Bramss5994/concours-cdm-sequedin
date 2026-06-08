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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      matches: {
        Row: {
          created_at: string
          finished: boolean
          group_letter: string | null
          id: string
          kickoff_at: string
          matchday: number | null
          score_a: number | null
          score_b: number | null
          stadium: string | null
          stage: Database["public"]["Enums"]["match_stage"]
          team_a_id: string | null
          team_a_placeholder: string | null
          team_b_id: string | null
          team_b_placeholder: string | null
          winner_team_id: string | null
        }
        Insert: {
          created_at?: string
          finished?: boolean
          group_letter?: string | null
          id?: string
          kickoff_at: string
          matchday?: number | null
          score_a?: number | null
          score_b?: number | null
          stadium?: string | null
          stage: Database["public"]["Enums"]["match_stage"]
          team_a_id?: string | null
          team_a_placeholder?: string | null
          team_b_id?: string | null
          team_b_placeholder?: string | null
          winner_team_id?: string | null
        }
        Update: {
          created_at?: string
          finished?: boolean
          group_letter?: string | null
          id?: string
          kickoff_at?: string
          matchday?: number | null
          score_a?: number | null
          score_b?: number | null
          stadium?: string | null
          stage?: Database["public"]["Enums"]["match_stage"]
          team_a_id?: string | null
          team_a_placeholder?: string | null
          team_b_id?: string | null
          team_b_placeholder?: string | null
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_team_a_id_fkey"
            columns: ["team_a_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team_b_id_fkey"
            columns: ["team_b_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          club: string | null
          created_at: string
          id: string
          is_top_scorer: boolean
          name: string
          position: string
          team_id: string
        }
        Insert: {
          club?: string | null
          created_at?: string
          id?: string
          is_top_scorer?: boolean
          name: string
          position: string
          team_id: string
        }
        Update: {
          club?: string | null
          created_at?: string
          id?: string
          is_top_scorer?: boolean
          name?: string
          position?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          exact_score: boolean
          good_winner: boolean
          id: string
          match_id: string
          points: number
          score_a: number
          score_b: number
          updated_at: string
          user_id: string
          winner_team_id: string | null
        }
        Insert: {
          exact_score?: boolean
          good_winner?: boolean
          id?: string
          match_id: string
          points?: number
          score_a: number
          score_b: number
          updated_at?: string
          user_id: string
          winner_team_id?: string | null
        }
        Update: {
          exact_score?: boolean
          good_winner?: boolean
          id?: string
          match_id?: string
          points?: number
          score_a?: number
          score_b?: number
          updated_at?: string
          user_id?: string
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          depot: Database["public"]["Enums"]["depot"]
          email: string
          favorite_team_id: string | null
          id: string
          num_paie: string
          prenom: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          depot?: Database["public"]["Enums"]["depot"]
          email: string
          favorite_team_id?: string | null
          id: string
          num_paie?: string
          prenom?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          depot?: Database["public"]["Enums"]["depot"]
          email?: string
          favorite_team_id?: string | null
          id?: string
          num_paie?: string
          prenom?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_favorite_team_id_fkey"
            columns: ["favorite_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          code: string
          group_letter: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          group_letter?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          group_letter?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      top_scorer_predictions: {
        Row: {
          created_at: string
          player_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          player_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          player_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "top_scorer_predictions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "top_scorer_predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "top_scorer_predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_admins: {
        Row: {
          active: boolean
          created_at: string
          depot: Database["public"]["Enums"]["depot"]
          id: string
          login_code: string
          password_hash: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          depot: Database["public"]["Enums"]["depot"]
          id?: string
          login_code: string
          password_hash: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          depot?: Database["public"]["Enums"]["depot"]
          id?: string
          login_code?: string
          password_hash?: string
          updated_at?: string
        }
        Relationships: []
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
      winner_predictions: {
        Row: {
          created_at: string
          final_locked_at: string | null
          final_team_id: string | null
          initial_locked_at: string | null
          initial_team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          final_locked_at?: string | null
          final_team_id?: string | null
          initial_locked_at?: string | null
          initial_team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          final_locked_at?: string | null
          final_team_id?: string | null
          initial_locked_at?: string | null
          initial_team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "winner_predictions_final_team_id_fkey"
            columns: ["final_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "winner_predictions_initial_team_id_fkey"
            columns: ["initial_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "winner_predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "winner_predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      leaderboard: {
        Row: {
          exact_scores: number | null
          good_winners: number | null
          nom: string | null
          predictions_count: number | null
          prenom: string | null
          total_points: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_own_email: { Args: never; Returns: string }
      get_public_profiles: {
        Args: never
        Returns: {
          active: boolean
          depot: Database["public"]["Enums"]["depot"]
          id: string
          num_paie: string
          prenom: string
        }[]
      }
      get_top_scorer_board: {
        Args: never
        Returns: {
          bonus: number
          depot: Database["public"]["Enums"]["depot"]
          num_paie: string
          player_club: string
          player_id: string
          player_name: string
          prenom: string
          team_name: string
          user_id: string
        }[]
      }
      get_top_scorer_bonuses: {
        Args: never
        Returns: {
          bonus: number
          user_id: string
        }[]
      }
      get_winner_board: {
        Args: never
        Returns: {
          bonus: number
          depot: Database["public"]["Enums"]["depot"]
          final_team_code: string
          final_team_id: string
          final_team_name: string
          initial_team_code: string
          initial_team_id: string
          initial_team_name: string
          num_paie: string
          prenom: string
          user_id: string
        }[]
      }
      get_winner_bonuses: {
        Args: never
        Returns: {
          bonus: number
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      recompute_match_points: {
        Args: { _match_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
      depot:
        | "sequedin"
        | "faidherbe"
        | "wattrelos"
        | "pc_bus"
        | "tram"
        | "copem"
        | "support"
      match_stage: "group" | "r32" | "r16" | "qf" | "sf" | "third" | "final"
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
      app_role: ["admin", "user"],
      depot: [
        "sequedin",
        "faidherbe",
        "wattrelos",
        "pc_bus",
        "tram",
        "copem",
        "support",
      ],
      match_stage: ["group", "r32", "r16", "qf", "sf", "third", "final"],
    },
  },
} as const
