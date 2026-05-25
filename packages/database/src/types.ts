// Hand-maintained until `supabase gen types` is wired into CI.
// Run: pnpm dlx supabase gen types typescript --project-id <id> > packages/database/src/types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          subscription_tier: string;
          subscription_status: string | null;
          subscription_expires_at: string | null;
          paystack_customer_id: string | null;
          paystack_subscription_code: string | null;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          subscription_tier?: string;
          subscription_status?: string | null;
          subscription_expires_at?: string | null;
          paystack_customer_id?: string | null;
          paystack_subscription_code?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          subscription_tier?: string;
          subscription_status?: string | null;
          subscription_expires_at?: string | null;
          paystack_customer_id?: string | null;
          paystack_subscription_code?: string | null;
        };
        Relationships: [];
      };
      usage_tracking: {
        Row: {
          id: string;
          user_id: string;
          feature: string;
          month: string;
          count: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          feature: string;
          month: string;
          count?: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          feature?: string;
          month?: string;
          count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "usage_tracking_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      note_folders: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          icon: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color?: string;
          icon?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          color?: string;
          icon?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "note_folders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      study_notes: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          content: string | null;
          ai_summary: string | null;
          folder_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          content?: string | null;
          ai_summary?: string | null;
          folder_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          content?: string | null;
          ai_summary?: string | null;
          folder_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "study_notes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "study_notes_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "note_folders";
            referencedColumns: ["id"];
          },
        ];
      };
      flashcards: {
        Row: {
          id: string;
          note_id: string;
          user_id: string;
          question: string;
          answer: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          note_id: string;
          user_id: string;
          question: string;
          answer: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          note_id?: string;
          user_id?: string;
          question?: string;
          answer?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "flashcards_note_id_fkey";
            columns: ["note_id"];
            isOneToOne: false;
            referencedRelation: "study_notes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "flashcards_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      study_group_members: {
        Row: {
          id: string;
          group_id: string;
          user_id: string;
          role: string;
          joined_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          user_id: string;
          role?: string;
          joined_at?: string;
        };
        Update: {
          id?: string;
          group_id?: string;
          user_id?: string;
          role?: string;
          joined_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "study_group_members_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "study_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "study_group_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      study_group_notes: {
        Row: {
          id: string;
          group_id: string;
          note_id: string;
          shared_by: string;
          shared_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          note_id: string;
          shared_by: string;
          shared_at?: string;
        };
        Update: {
          id?: string;
          group_id?: string;
          note_id?: string;
          shared_by?: string;
          shared_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "study_group_notes_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "study_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "study_group_notes_note_id_fkey";
            columns: ["note_id"];
            isOneToOne: false;
            referencedRelation: "study_notes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "study_group_notes_shared_by_fkey";
            columns: ["shared_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      study_groups: {
        Row: {
          id: string;
          name: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "study_groups_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      exam_uploads: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          content: string;
          status: string;
          predictions: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          content: string;
          status?: string;
          predictions?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          content?: string;
          status?: string;
          predictions?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exam_uploads_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      study_sessions: {
        Row: {
          id: string; group_id: string; host_id: string; note_id: string;
          note_title: string; current_card_index: number; is_active: boolean;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; group_id: string; host_id: string; note_id: string;
          note_title: string; current_card_index?: number; is_active?: boolean;
          created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; group_id?: string; host_id?: string; note_id?: string;
          note_title?: string; current_card_index?: number; is_active?: boolean;
          created_at?: string; updated_at?: string;
        };
        Relationships: [];
      };
      session_participants: {
        Row: { id: string; session_id: string; user_id: string; joined_at: string };
        Insert: { id?: string; session_id: string; user_id: string; joined_at?: string };
        Update: { id?: string; session_id?: string; user_id?: string; joined_at?: string };
        Relationships: [];
      };
      group_notes: {
        Row: {
          id: string; group_id: string; created_by: string; title: string;
          content: string | null; ai_summary: string | null;
          last_edited_by: string | null; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; group_id: string; created_by: string; title: string;
          content?: string | null; ai_summary?: string | null;
          last_edited_by?: string | null; created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; group_id?: string; created_by?: string; title?: string;
          content?: string | null; ai_summary?: string | null;
          last_edited_by?: string | null; created_at?: string; updated_at?: string;
        };
        Relationships: [];
      };
      group_notifications: {
        Row: {
          id: string; user_id: string; group_id: string; from_user_id: string;
          type: string; message: string; note_id: string | null;
          is_read: boolean; created_at: string;
        };
        Insert: {
          id?: string; user_id: string; group_id: string; from_user_id: string;
          type?: string; message: string; note_id?: string | null;
          is_read?: boolean; created_at?: string;
        };
        Update: {
          id?: string; user_id?: string; group_id?: string; from_user_id?: string;
          type?: string; message?: string; note_id?: string | null;
          is_read?: boolean; created_at?: string;
        };
        Relationships: [];
      };
      group_exam_uploads: {
        Row: { id: string; group_id: string; uploaded_by: string; title: string; content: string; created_at: string };
        Insert: { id?: string; group_id: string; uploaded_by: string; title: string; content: string; created_at?: string };
        Update: { id?: string; group_id?: string; uploaded_by?: string; title?: string; content?: string; created_at?: string };
        Relationships: [];
      };
      group_predictions: {
        Row: {
          id: string; group_id: string; papers_count: number; members_count: number;
          status: string; predictions: Json | null; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; group_id: string; papers_count?: number; members_count?: number;
          status?: string; predictions?: Json | null; created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; group_id?: string; papers_count?: number; members_count?: number;
          status?: string; predictions?: Json | null; created_at?: string; updated_at?: string;
        };
        Relationships: [];
      };
      note_comments: {
        Row: {
          id: string; group_id: string; note_id: string; user_id: string;
          content: string | null; reaction: string | null; created_at: string;
        };
        Insert: {
          id?: string; group_id: string; note_id: string; user_id: string;
          content?: string | null; reaction?: string | null; created_at?: string;
        };
        Update: {
          id?: string; group_id?: string; note_id?: string; user_id?: string;
          content?: string | null; reaction?: string | null; created_at?: string;
        };
        Relationships: [];
      };
      study_streaks: {
        Row: {
          id: string;
          user_id: string;
          current_streak: number;
          longest_streak: number;
          last_study_date: string | null;
          total_study_days: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          current_streak?: number;
          longest_streak?: number;
          last_study_date?: string | null;
          total_study_days?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          current_streak?: number;
          longest_streak?: number;
          last_study_date?: string | null;
          total_study_days?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "study_streaks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      study_activity: {
        Row: {
          id: string;
          user_id: string;
          activity_date: string;
          notes_created: number;
          flashcards_reviewed: number;
          exams_uploaded: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          activity_date: string;
          notes_created?: number;
          flashcards_reviewed?: number;
          exams_uploaded?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          activity_date?: string;
          notes_created?: number;
          flashcards_reviewed?: number;
          exams_uploaded?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "study_activity_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      reminders: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          remind_at: string | null;
          is_sent: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string | null;
          remind_at?: string | null;
          is_sent?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string | null;
          remind_at?: string | null;
          is_sent?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reminders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      set_updated_at: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      increment_activity: {
        Args: { p_user_id: string; p_date: string; p_column: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

// Convenience row types for use throughout the app
export type UserRow              = Database["public"]["Tables"]["users"]["Row"];
export type UsageTrackingRow     = Database["public"]["Tables"]["usage_tracking"]["Row"];
export type NoteFolderRow        = Database["public"]["Tables"]["note_folders"]["Row"];
export type StudyNoteRow         = Database["public"]["Tables"]["study_notes"]["Row"];
export type FlashcardRow         = Database["public"]["Tables"]["flashcards"]["Row"];
export type StudyGroupRow        = Database["public"]["Tables"]["study_groups"]["Row"];
export type StudyGroupMemberRow  = Database["public"]["Tables"]["study_group_members"]["Row"];
export type GroupNoteRow         = Database["public"]["Tables"]["study_group_notes"]["Row"];
export type ExamUploadRow        = Database["public"]["Tables"]["exam_uploads"]["Row"];
export type StudySessionRow       = Database["public"]["Tables"]["study_sessions"]["Row"];
export type SessionParticipantRow = Database["public"]["Tables"]["session_participants"]["Row"];
export type CollabGroupNoteRow    = Database["public"]["Tables"]["group_notes"]["Row"];
export type GroupNotificationRow  = Database["public"]["Tables"]["group_notifications"]["Row"];
export type GroupExamUploadRow    = Database["public"]["Tables"]["group_exam_uploads"]["Row"];
export type GroupPredictionRow    = Database["public"]["Tables"]["group_predictions"]["Row"];
export type NoteCommentRow        = Database["public"]["Tables"]["note_comments"]["Row"];
export type StudyStreakRow        = Database["public"]["Tables"]["study_streaks"]["Row"];
export type StudyActivityRow     = Database["public"]["Tables"]["study_activity"]["Row"];
export type ReminderRow          = Database["public"]["Tables"]["reminders"]["Row"];

// Insert helpers
export type StudyNoteInsert  = Database["public"]["Tables"]["study_notes"]["Insert"];
export type FlashcardInsert  = Database["public"]["Tables"]["flashcards"]["Insert"];
export type StudyGroupInsert = Database["public"]["Tables"]["study_groups"]["Insert"];
export type ReminderInsert   = Database["public"]["Tables"]["reminders"]["Insert"];
