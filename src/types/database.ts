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
  bio: string | null;
  role: "member" | "moderator" | "admin";
  banned_at: string | null;
  ban_reason: string | null;
  created_at: string;
  updated_at: string;
}
type ProfileInsert = WithOptional<
  ProfileRow,
  | "display_name"
  | "avatar_url"
  | "bio"
  | "role"
  | "banned_at"
  | "ban_reason"
  | "created_at"
  | "updated_at"
>;

export interface ProfileStatsRow {
  user_id: string;
  colors_captured: number;
  palettes_created: number;
  creations_made: number;
  creations_shared: number;
  remixes_made: number;
  collections_count: number;
  most_used_family: ColorFamilyRow | null;
}

// ---------------------------------------------------------------------------
// Community catalogue (pre-ColorLens, renamed from `colors` — see
// supabase/migrations/20260913100000_colorlens_rename_community.sql)
// ---------------------------------------------------------------------------

export interface CommunityColorRow {
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
type CommunityColorInsert = WithOptional<
  CommunityColorRow,
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
  | "id"
  | "proposed_by"
  | "status"
  | "moderated_by"
  | "moderated_at"
  | "moderation_reason"
  | "created_at"
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

// ---------------------------------------------------------------------------
// ColorLens §9
// ---------------------------------------------------------------------------

/** Stored alongside hex so a save keeps the precision the engine measured. */
export type StoredRgb = { r: number; g: number; b: number };
export type StoredHsl = { h: number; s: number; l: number };
export type StoredHsv = { h: number; s: number; v: number };
export type StoredLab = { L: number; a: number; b: number };

export type ColorSourceType = "camera" | "gallery" | "manual" | "mix" | "palette";

export interface ColorRow {
  id: string;
  user_id: string;
  name: string | null;
  hex: string;
  rgb: StoredRgb | null;
  hsl: StoredHsl | null;
  hsv: StoredHsv | null;
  lab: StoredLab | null;
  family: ColorFamilyRow | null;
  source_image_url: string | null;
  source_type: ColorSourceType;
  uncertainty: number | null;
  is_public: boolean;
  community_color_id: string | null;
  created_at: string;
}
type ColorInsert = WithOptional<
  ColorRow,
  | "id"
  | "name"
  | "rgb"
  | "hsl"
  | "hsv"
  | "lab"
  | "family"
  | "source_image_url"
  | "source_type"
  | "uncertainty"
  | "is_public"
  | "community_color_id"
  | "created_at"
>;

export type PaletteColorRole =
  | "dominant"
  | "secondary"
  | "accent"
  | "light"
  | "dark"
  | "neutral";

export interface PaletteRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  source_scheme: string | null;
  is_public: boolean;
  created_at: string;
}
type PaletteInsert = WithOptional<
  PaletteRow,
  "id" | "description" | "cover_image_url" | "source_scheme" | "is_public" | "created_at"
>;

export interface PaletteColorRow {
  palette_id: string;
  position: number;
  color_id: string | null;
  hex: string;
  role: PaletteColorRole | null;
}

export type ObjectCategory =
  | "fashion"
  | "shoes"
  | "automotive"
  | "home"
  | "accessories"
  | "design";

export interface ObjectRow {
  id: string;
  name: string;
  category: ObjectCategory;
  kind: "vector" | "raster";
  thumbnail_url: string | null;
  preview_url: string | null;
  model_3d_url: string | null;
  /** Shaped by `src/objects/types.ts`. Validated at the API boundary. */
  configuration: unknown;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface CreationRow {
  id: string;
  user_id: string;
  object_id: string;
  name: string;
  description: string | null;
  source_color_id: string | null;
  palette_id: string | null;
  preview_url: string | null;
  /** Full Studio state — shaped by `src/objects/types.ts`. */
  project_data: unknown;
  tags: string[];
  is_public: boolean;
  remixed_from: string | null;
  created_at: string;
  updated_at: string;
}
type CreationInsert = WithOptional<
  CreationRow,
  | "id"
  | "description"
  | "source_color_id"
  | "palette_id"
  | "preview_url"
  | "project_data"
  | "tags"
  | "is_public"
  | "remixed_from"
  | "created_at"
  | "updated_at"
>;

export interface CollectionRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}
type CollectionInsert = WithOptional<
  CollectionRow,
  "id" | "description" | "cover_url" | "is_public" | "created_at" | "updated_at"
>;

export type CollectionItemType = "color" | "palette" | "creation";

export interface CollectionItemRow {
  collection_id: string;
  item_type: CollectionItemType;
  item_id: string;
  position: number;
  created_at: string;
}

export interface LikeRow {
  user_id: string;
  creation_id: string;
  created_at: string;
}

export interface CreationLikeCountRow {
  creation_id: string;
  likes: number;
}

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
      community_colors: {
        Row: CommunityColorRow;
        Insert: CommunityColorInsert;
        Update: Partial<CommunityColorRow>;
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
      colors: {
        Row: ColorRow;
        Insert: ColorInsert;
        Update: Partial<ColorRow>;
        Relationships: [];
      };
      palettes: {
        Row: PaletteRow;
        Insert: PaletteInsert;
        Update: Partial<PaletteRow>;
        Relationships: [];
      };
      palette_colors: {
        Row: PaletteColorRow;
        Insert: PaletteColorRow;
        Update: Partial<PaletteColorRow>;
        Relationships: [];
      };
      objects: {
        Row: ObjectRow;
        Insert: ObjectRow;
        Update: Partial<ObjectRow>;
        Relationships: [];
      };
      object_favorites: {
        Row: { user_id: string; object_id: string; created_at: string };
        Insert: { user_id: string; object_id: string; created_at?: string };
        Update: Partial<{ user_id: string; object_id: string }>;
        Relationships: [];
      };
      creations: {
        Row: CreationRow;
        Insert: CreationInsert;
        Update: Partial<CreationRow>;
        Relationships: [];
      };
      collections: {
        Row: CollectionRow;
        Insert: CollectionInsert;
        Update: Partial<CollectionRow>;
        Relationships: [];
      };
      collection_items: {
        Row: CollectionItemRow;
        Insert: WithOptional<CollectionItemRow, "position" | "created_at">;
        Update: Partial<CollectionItemRow>;
        Relationships: [];
      };
      likes: {
        Row: LikeRow;
        Insert: WithOptional<LikeRow, "created_at">;
        Update: Partial<LikeRow>;
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
      creation_like_counts: { Row: CreationLikeCountRow; Relationships: [] };
      profile_stats: { Row: ProfileStatsRow; Relationships: [] };
    };
    Functions: {
      delete_own_account: { Args: Record<string, never>; Returns: void };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
