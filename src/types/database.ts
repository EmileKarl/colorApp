/**
 * Hand-written types mirroring supabase/migrations/*.sql.
 * Regenerate/replace with `supabase gen types typescript` once a real
 * project exists, to keep this in sync with the actual schema automatically.
 */

export type ColorFamilyRow =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "cyan"
  | "blue"
  | "purple"
  | "pink"
  | "brown"
  | "gray"
  | "black"
  | "white";

export type ModerationStatus = "pending" | "approved" | "rejected";

/** Marks columns that have a DB default/are nullable as optional on insert. */
type WithOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export interface ProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  role: "member" | "moderator" | "admin";
  banned_at: string | null;
  ban_reason: string | null;
  created_at: string;
  updated_at: string;
}
type ProfileInsert = WithOptional<
  ProfileRow,
  "display_name" | "avatar_url" | "role" | "banned_at" | "ban_reason" | "created_at" | "updated_at"
>;

export interface ColorRow {
  id: string;
  hex: string;
  r: number;
  g: number;
  b: number;
  family: ColorFamilyRow;
  cover_image_url: string | null;
  discovered_by: string | null;
  status: "active" | "hidden";
  created_at: string;
}
type ColorInsert = WithOptional<
  ColorRow,
  "id" | "cover_image_url" | "discovered_by" | "status" | "created_at"
>;

export interface ColorNameRow {
  id: string;
  color_id: string;
  name: string;
  proposed_by: string | null;
  status: ModerationStatus;
  moderated_by: string | null;
  moderated_at: string | null;
  moderation_reason: string | null;
  created_at: string;
}
type ColorNameInsert = WithOptional<
  ColorNameRow,
  "id" | "proposed_by" | "status" | "moderated_by" | "moderated_at" | "moderation_reason" | "created_at"
>;

export interface VoteRow {
  id: string;
  color_name_id: string;
  voter_id: string;
  value: 1 | -1;
  created_at: string;
}
type VoteInsert = WithOptional<VoteRow, "id" | "created_at">;

export interface ColorNameRankingRow {
  color_name_id: string;
  color_id: string;
  name: string;
  proposed_by: string | null;
  hex: string;
  family: ColorFamilyRow;
  score: number;
  upvotes: number;
  downvotes: number;
}

export interface SavedColorRow {
  id: string;
  user_id: string;
  color_id: string | null;
  hex: string;
  label: string | null;
  source_image_url: string | null;
  created_at: string;
}
type SavedColorInsert = WithOptional<
  SavedColorRow,
  "id" | "color_id" | "label" | "source_image_url" | "created_at"
>;

export interface ReportRow {
  id: string;
  reporter_id: string | null;
  target_type: "color" | "color_name" | "profile";
  target_id: string;
  reason: string;
  status: "open" | "resolved" | "dismissed";
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}
type ReportInsert = WithOptional<
  ReportRow,
  "id" | "reporter_id" | "status" | "resolved_by" | "resolved_at" | "created_at"
>;

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      colors: {
        Row: ColorRow;
        Insert: ColorInsert;
        Update: Partial<ColorRow>;
        Relationships: [];
      };
      color_names: {
        Row: ColorNameRow;
        Insert: ColorNameInsert;
        Update: Partial<ColorNameRow>;
        Relationships: [];
      };
      votes: {
        Row: VoteRow;
        Insert: VoteInsert;
        Update: Partial<VoteRow>;
        Relationships: [];
      };
      saved_colors: {
        Row: SavedColorRow;
        Insert: SavedColorInsert;
        Update: Partial<SavedColorRow>;
        Relationships: [];
      };
      reports: {
        Row: ReportRow;
        Insert: ReportInsert;
        Update: Partial<ReportRow>;
        Relationships: [];
      };
    };
    Views: {
      color_name_rankings: { Row: ColorNameRankingRow; Relationships: [] };
    };
    Functions: {
      delete_own_account: { Args: Record<string, never>; Returns: void };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
