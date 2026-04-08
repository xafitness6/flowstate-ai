// ─── Supabase Database Types ───────────────────────────────────────────────────
// Keep in sync with the SQL schema in supabase/migrations/001_initial_schema.sql
// Generate automatically with: npx supabase gen types typescript --linked > src/lib/supabase/types.ts

export type Role = "master" | "trainer" | "client" | "member";
export type Plan = "foundation" | "training" | "performance" | "coaching";
export type InviteStatus = "pending" | "sent" | "accepted" | "expired" | "revoked";
export type LogType = "prescribed" | "modified" | "freestyle" | "coach_note";
export type NutritionSource = "manual" | "voice" | "coach";

// ─── Row types ───────────────────────────────────────────────────────────────

export interface Profile {
  id:                  string;
  email:               string;
  first_name:          string | null;
  last_name:           string | null;
  full_name:           string | null;
  avatar_url:          string | null;
  bio:                 string | null;
  role:                Role;
  is_admin:            boolean;
  assigned_trainer_id: string | null;
  plan:                Plan;
  default_dashboard:   string;
  push_level:          number;
  created_at:          string;
  updated_at:          string;
}

export interface OnboardingState {
  id:                            string;
  user_id:                       string;
  onboarding_complete:           boolean;
  body_focus_complete:           boolean;
  planning_conversation_complete: boolean;
  program_generated:             boolean;
  tutorial_complete:             boolean;
  profile_complete:              boolean;
  onboarding_step:               string | null;
  raw_answers:                   Record<string, unknown> | null;
  coach_summary:                 string | null;
  current_plan_duration:         number | null;
  created_at:                    string;
  updated_at:                    string;
}

export interface Program {
  id:                    string;
  user_id:               string;
  block_name:            string;
  goal:                  string;
  duration_weeks:        number;
  weekly_split:          Record<string, unknown>;
  weekly_training_days:  number;
  session_length_target: number;
  body_focus_areas:      string[];
  equipment_profile:     string[];
  coaching_notes:        string | null;
  status:                "active" | "completed" | "archived";
  start_date:            string | null;
  end_date:              string | null;
  created_at:            string;
  updated_at:            string;
}

export interface Workout {
  id:                 string;
  program_id:         string;
  user_id:            string;
  workout_name:       string;
  day_label:          string;
  scheduled_day:      number;
  estimated_duration: number;
  focus_areas:        string[];
  warmup:             Record<string, unknown>;
  exercises:          Record<string, unknown>[];
  status:             "pending" | "completed" | "skipped";
  created_at:         string;
  updated_at:         string;
}

export interface WorkoutLog {
  id:               string;
  user_id:          string;
  workout_id:       string | null;
  log_type:         LogType;
  workout_name:     string;
  body_focus:       string | null;
  transcript:       string | null;
  notes:            string | null;
  completed_at:     string;
  duration_minutes: number;
  sets_completed:   number;
  exercise_results: Record<string, unknown>[];
  difficulty:       number | null;
  parsed_confidence: number | null;
  voice_entry_id:   string | null;
  created_at:       string;
}

export interface Invite {
  id:                   string;
  invite_token:         string;
  invite_type:          "direct" | "open";
  invite_email:         string | null;
  first_name:           string | null;
  last_name:            string | null;
  invited_by_user_id:   string;
  assigned_trainer_id:  string | null;
  assigned_trainer_name: string | null;
  invited_by_name:      string | null;
  invite_status:        InviteStatus;
  invite_message:       string | null;
  accepted_by_user_id:  string | null;
  invited_at:           string;
  accepted_at:          string | null;
  expires_at:           string | null;
}

export interface NutritionLog {
  id:          string;
  user_id:     string;
  meal_type:   string | null;
  raw_text:    string;
  parsed_data: Record<string, unknown> | null;
  source:      NutritionSource;
  logged_at:   string;
  created_at:  string;
}

export interface CoachConversation {
  id:               string;
  user_id:          string;
  context_type:     string;
  transcript:       Record<string, unknown>[];
  structured_output: Record<string, unknown> | null;
  updated_at:       string;
  created_at:       string;
}

// ─── Database shape (for createClient generic) ───────────────────────────────

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row:    Profile;
        Insert: Partial<Profile> & { id: string; email: string };
        Update: Partial<Profile>;
      };
      onboarding_state: {
        Row:    OnboardingState;
        Insert: Partial<OnboardingState> & { user_id: string };
        Update: Partial<OnboardingState>;
      };
      programs: {
        Row:    Program;
        Insert: Partial<Program> & { user_id: string; block_name: string; goal: string };
        Update: Partial<Program>;
      };
      workouts: {
        Row:    Workout;
        Insert: Partial<Workout> & { program_id: string; user_id: string; workout_name: string };
        Update: Partial<Workout>;
      };
      workout_logs: {
        Row:    WorkoutLog;
        Insert: Partial<WorkoutLog> & { user_id: string; workout_name: string };
        Update: Partial<WorkoutLog>;
      };
      invites: {
        Row:    Invite;
        Insert: Partial<Invite> & { invited_by_user_id: string; invite_token: string };
        Update: Partial<Invite>;
      };
      nutrition_logs: {
        Row:    NutritionLog;
        Insert: Partial<NutritionLog> & { user_id: string; raw_text: string };
        Update: Partial<NutritionLog>;
      };
      coach_conversations: {
        Row:    CoachConversation;
        Insert: Partial<CoachConversation> & { user_id: string };
        Update: Partial<CoachConversation>;
      };
    };
    Views:     Record<string, never>;
    Functions: Record<string, never>;
    Enums:     Record<string, never>;
  };
}
