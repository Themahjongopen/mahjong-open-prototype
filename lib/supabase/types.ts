export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type UserRole = "player" | "admin" | "commissioner";
export type MembershipStatus = "pending" | "active" | "canceled";
export type PaidStatus = "unpaid" | "paid" | "refunded";
export type TableStatus = "open" | "full" | "completed" | "canceled";
export type ScoreStatus = "pending" | "approved" | "rejected" | "edited";
export type SkillLevel = "beginner" | "intermediate" | "advanced";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          role: UserRole;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          role?: UserRole;
          created_at?: string;
        };
        Update: {
          full_name?: string | null;
          email?: string | null;
          role?: UserRole;
        };
        Relationships: [];
      };
      cities: {
        Row: {
          id: string;
          name: string;
          state: string | null;
          slug: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          state?: string | null;
          slug: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          state?: string | null;
          slug?: string;
          is_active?: boolean;
        };
        Relationships: [];
      };
      seasons: {
        Row: {
          id: string;
          city_id: string;
          name: string;
          year: number | null;
          quarter: number | null;
          starts_at: string | null;
          ends_at: string | null;
          total_weeks: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          city_id: string;
          name: string;
          year?: number | null;
          quarter?: number | null;
          starts_at?: string | null;
          ends_at?: string | null;
          total_weeks?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          year?: number | null;
          quarter?: number | null;
          starts_at?: string | null;
          ends_at?: string | null;
          total_weeks?: number;
          is_active?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "seasons_city_id_fkey";
            columns: ["city_id"];
            isOneToOne: false;
            referencedRelation: "cities";
            referencedColumns: ["id"];
          },
        ];
      };
      city_memberships: {
        Row: {
          id: string;
          user_id: string;
          city_id: string;
          season_id: string;
          status: MembershipStatus;
          paid_status: PaidStatus;
          skill_level: SkillLevel | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          city_id: string;
          season_id: string;
          status?: MembershipStatus;
          paid_status?: PaidStatus;
          skill_level?: SkillLevel | null;
          created_at?: string;
        };
        Update: {
          status?: MembershipStatus;
          paid_status?: PaidStatus;
          skill_level?: SkillLevel | null;
        };
        Relationships: [
          {
            foreignKeyName: "city_memberships_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "city_memberships_city_id_fkey";
            columns: ["city_id"];
            isOneToOne: false;
            referencedRelation: "cities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "city_memberships_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          user_id: string;
          city_id: string;
          season_id: string;
          amount: number | null;
          status: string | null;
          provider: string | null;
          provider_payment_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          city_id: string;
          season_id: string;
          amount?: number | null;
          status?: string | null;
          provider?: string | null;
          provider_payment_id?: string | null;
          created_at?: string;
        };
        Update: {
          amount?: number | null;
          status?: string | null;
          provider_payment_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_city_id_fkey";
            columns: ["city_id"];
            isOneToOne: false;
            referencedRelation: "cities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
        ];
      };
      scramble_tables: {
        Row: {
          id: string;
          city_id: string;
          season_id: string;
          creator_id: string;
          week_number: number;
          table_date: string;
          table_time: string;
          location_name: string;
          location_address: string | null;
          skill_level: SkillLevel | null;
          notes: string | null;
          status: TableStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          city_id: string;
          season_id: string;
          creator_id: string;
          week_number: number;
          table_date: string;
          table_time: string;
          location_name: string;
          location_address?: string | null;
          skill_level?: SkillLevel | null;
          notes?: string | null;
          status?: TableStatus;
          created_at?: string;
        };
        Update: {
          week_number?: number;
          table_date?: string;
          table_time?: string;
          location_name?: string;
          location_address?: string | null;
          skill_level?: SkillLevel | null;
          notes?: string | null;
          status?: TableStatus;
        };
        Relationships: [
          {
            foreignKeyName: "scramble_tables_city_id_fkey";
            columns: ["city_id"];
            isOneToOne: false;
            referencedRelation: "cities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scramble_tables_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scramble_tables_creator_id_fkey";
            columns: ["creator_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      table_seats: {
        Row: {
          id: string;
          table_id: string;
          user_id: string;
          seat_number: number;
          joined_at: string;
          canceled_at: string | null;
        };
        Insert: {
          id?: string;
          table_id: string;
          user_id: string;
          seat_number: number;
          joined_at?: string;
          canceled_at?: string | null;
        };
        Update: {
          canceled_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "table_seats_table_id_fkey";
            columns: ["table_id"];
            isOneToOne: false;
            referencedRelation: "scramble_tables";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "table_seats_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      score_submissions: {
        Row: {
          id: string;
          table_id: string;
          submitted_by: string;
          status: ScoreStatus;
          admin_notes: string | null;
          created_at: string;
          approved_at: string | null;
          approved_by: string | null;
        };
        Insert: {
          id?: string;
          table_id: string;
          submitted_by: string;
          status?: ScoreStatus;
          admin_notes?: string | null;
          created_at?: string;
          approved_at?: string | null;
          approved_by?: string | null;
        };
        Update: {
          status?: ScoreStatus;
          admin_notes?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "score_submissions_table_id_fkey";
            columns: ["table_id"];
            isOneToOne: false;
            referencedRelation: "scramble_tables";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "score_submissions_submitted_by_fkey";
            columns: ["submitted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "score_submissions_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      score_submission_players: {
        Row: {
          id: string;
          score_submission_id: string;
          user_id: string;
          wins: number;
          points: number;
          notes: string | null;
        };
        Insert: {
          id?: string;
          score_submission_id: string;
          user_id: string;
          wins?: number;
          points?: number;
          notes?: string | null;
        };
        Update: {
          wins?: number;
          points?: number;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "score_submission_players_score_submission_id_fkey";
            columns: ["score_submission_id"];
            isOneToOne: false;
            referencedRelation: "score_submissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "score_submission_players_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      standings: {
        Row: {
          id: string;
          city_id: string;
          season_id: string;
          user_id: string;
          total_points: number;
          total_wins: number;
          tables_played: number;
          rank: number | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          city_id: string;
          season_id: string;
          user_id: string;
          total_points?: number;
          total_wins?: number;
          tables_played?: number;
          rank?: number | null;
          updated_at?: string;
        };
        Update: {
          total_points?: number;
          total_wins?: number;
          tables_played?: number;
          rank?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "standings_city_id_fkey";
            columns: ["city_id"];
            isOneToOne: false;
            referencedRelation: "cities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "standings_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "standings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      announcements: {
        Row: {
          id: string;
          city_id: string | null;
          season_id: string | null;
          title: string;
          body: string;
          pinned: boolean;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          city_id?: string | null;
          season_id?: string | null;
          title: string;
          body: string;
          pinned?: boolean;
          created_by: string;
          created_at?: string;
        };
        Update: {
          title?: string;
          body?: string;
          pinned?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "announcements_city_id_fkey";
            columns: ["city_id"];
            isOneToOne: false;
            referencedRelation: "cities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "announcements_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      // Directory-safe member roster (migration 009). RLS-scoped to the
      // viewer's paid city+series cohort; exposes no private columns.
      directory_members: {
        Row: {
          profile_id: string | null;
          full_name: string | null;
          city_id: string | null;
          city_name: string | null;
          skill_level: SkillLevel | null;
          is_commissioner: boolean | null;
          series_id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_role: UserRole;
      membership_status: MembershipStatus;
      paid_status: PaidStatus;
      table_status: TableStatus;
      score_status: ScoreStatus;
      skill_level: SkillLevel;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
