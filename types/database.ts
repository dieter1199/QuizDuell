export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string;
          name: string;
          description: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      questions: {
        Row: {
          id: string;
          category_id: string;
          prompt: string;
          answers: Json;
          correct_answer_indexes: number[];
          explanation: string | null;
          difficulty: "easy" | "medium" | "hard";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          prompt: string;
          answers: Json;
          correct_answer_indexes: number[];
          explanation?: string | null;
          difficulty: "easy" | "medium" | "hard";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string;
          prompt?: string;
          answers?: Json;
          correct_answer_indexes?: number[];
          explanation?: string | null;
          difficulty?: "easy" | "medium" | "hard";
          created_at?: string;
          updated_at?: string;
        };
      };
      rooms: {
        Row: {
          id: string;
          code: string;
          status: "lobby" | "active" | "closed";
          settings: Json;
          host_player_id: string | null;
          current_game_id: string | null;
          closed_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          status?: "lobby" | "active" | "closed";
          settings: Json;
          host_player_id?: string | null;
          current_game_id?: string | null;
          closed_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          status?: "lobby" | "active" | "closed";
          settings?: Json;
          host_player_id?: string | null;
          current_game_id?: string | null;
          closed_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      room_players: {
        Row: {
          id: string;
          room_id: string;
          player_token: string;
          display_name: string;
          is_host: boolean;
          status: "active" | "left" | "kicked";
          connection_status: "online" | "offline";
          joined_at: string;
          last_seen_at: string;
          left_at: string | null;
        };
        Insert: {
          id?: string;
          room_id: string;
          player_token: string;
          display_name: string;
          is_host?: boolean;
          status?: "active" | "left" | "kicked";
          connection_status?: "online" | "offline";
          joined_at?: string;
          last_seen_at?: string;
          left_at?: string | null;
        };
        Update: {
          id?: string;
          room_id?: string;
          player_token?: string;
          display_name?: string;
          is_host?: boolean;
          status?: "active" | "left" | "kicked";
          connection_status?: "online" | "offline";
          joined_at?: string;
          last_seen_at?: string;
          left_at?: string | null;
        };
      };
      game_sessions: {
        Row: {
          id: string;
          room_id: string;
          status: "active" | "finished" | "cancelled";
          phase: "question" | "reveal" | "finished";
          current_round_number: number;
          total_rounds: number;
          settings: Json;
          phase_started_at: string;
          phase_ends_at: string;
          started_at: string;
          ended_at: string | null;
        };
        Insert: {
          id?: string;
          room_id: string;
          status?: "active" | "finished" | "cancelled";
          phase?: "question" | "reveal" | "finished";
          current_round_number?: number;
          total_rounds: number;
          settings: Json;
          phase_started_at: string;
          phase_ends_at: string;
          started_at?: string;
          ended_at?: string | null;
        };
        Update: {
          id?: string;
          room_id?: string;
          status?: "active" | "finished" | "cancelled";
          phase?: "question" | "reveal" | "finished";
          current_round_number?: number;
          total_rounds?: number;
          settings?: Json;
          phase_started_at?: string;
          phase_ends_at?: string;
          started_at?: string;
          ended_at?: string | null;
        };
      };
      game_rounds: {
        Row: {
          id: string;
          game_session_id: string;
          question_id: string;
          round_number: number;
          answer_order: number[];
          created_at: string;
        };
        Insert: {
          id?: string;
          game_session_id: string;
          question_id: string;
          round_number: number;
          answer_order: number[];
          created_at?: string;
        };
        Update: {
          id?: string;
          game_session_id?: string;
          question_id?: string;
          round_number?: number;
          answer_order?: number[];
          created_at?: string;
        };
      };
      player_answers: {
        Row: {
          id: string;
          round_id: string;
          player_id: string;
          selected_indexes: number[];
          is_correct: boolean;
          timed_out: boolean;
          points_awarded: number;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          round_id: string;
          player_id: string;
          selected_indexes?: number[];
          is_correct?: boolean;
          timed_out?: boolean;
          points_awarded?: number;
          submitted_at?: string;
        };
        Update: {
          id?: string;
          round_id?: string;
          player_id?: string;
          selected_indexes?: number[];
          is_correct?: boolean;
          timed_out?: boolean;
          points_awarded?: number;
          submitted_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
