// supabase/types.ts
//
// Hand-written domain types mirroring supabase/migrations/*.sql. Kept in
// sync manually instead of via `supabase gen types` so every field carries
// a specific, named shape — e.g. `CardMetadata`/`WorkspaceSettings` for the
// jsonb columns, `MemberRole` as a closed union — rather than the generic
// `Json` blob the CLI generator produces for every jsonb column, or plain
// `Partial<Row>` for every write.
//
// `npm run types:gen` (Supabase CLI, requires `supabase start`/Docker)
// writes supabase/types.generated.ts as a drift check only — diff it
// against this file after a schema change, don't import it. The contract
// the frontend imports is this file.

export type MemberRole = 'owner' | 'admin' | 'member' | 'guest';

// ---------------------------------------------------------------------------
// profiles — mirrors auth.users, created by the on_auth_user_created trigger.
// ---------------------------------------------------------------------------

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileUpdate {
  full_name?: string | null;
  avatar_url?: string | null;
}

// ---------------------------------------------------------------------------
// workspaces
// ---------------------------------------------------------------------------

export interface WorkspaceSettings {
  default_board_id?: string;
  icon_color?: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  settings: WorkspaceSettings;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceInsert {
  name: string;
  slug: string;
  owner_id: string;
  settings?: WorkspaceSettings;
}

export interface WorkspaceUpdate {
  name?: string;
  slug?: string;
  settings?: WorkspaceSettings;
}

// ---------------------------------------------------------------------------
// teams
// ---------------------------------------------------------------------------

export interface Team {
  id: string;
  workspace_id: string;
  name: string;
  created_at: string;
}

export interface TeamInsert {
  workspace_id: string;
  name: string;
}

export interface TeamUpdate {
  name?: string;
}

// ---------------------------------------------------------------------------
// memberships — role is only ever changed via update; user/workspace are
// immutable once the row exists (delete + reinvite otherwise).
// ---------------------------------------------------------------------------

export interface Membership {
  id: string;
  user_id: string;
  workspace_id: string;
  team_id: string | null;
  role: MemberRole;
  invited_by: string | null;
  created_at: string;
}

export interface MembershipUpdate {
  role?: Exclude<MemberRole, 'owner'>;
  team_id?: string | null;
}

// ---------------------------------------------------------------------------
// workspace_invites — see invite_member()/accept_pending_invites() in
// 0005_invites.sql. Never inserted directly by the client; always through
// the invite_member RPC below.
// ---------------------------------------------------------------------------

export type InviteRole = Exclude<MemberRole, 'owner'>;
export type InviteOutcome = 'added' | 'invited';

export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  email: string;
  role: InviteRole;
  invited_by: string;
  accepted_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// boards
// ---------------------------------------------------------------------------

export interface Board {
  id: string;
  workspace_id: string;
  team_id: string | null;
  name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BoardInsert {
  workspace_id: string;
  team_id?: string | null;
  name: string;
  created_by: string;
}

export interface BoardUpdate {
  name?: string;
  team_id?: string | null;
}

// ---------------------------------------------------------------------------
// board_columns
// ---------------------------------------------------------------------------

export interface BoardColumn {
  id: string;
  board_id: string;
  name: string;
  position: number;
  created_at: string;
}

export interface BoardColumnInsert {
  board_id: string;
  name: string;
  position: number;
}

export interface BoardColumnUpdate {
  name?: string;
  position?: number;
}

// ---------------------------------------------------------------------------
// cards
// ---------------------------------------------------------------------------

export type CardPriority = 'low' | 'medium' | 'high';

export interface CardMetadata {
  due_date?: string; // ISO 8601 date, e.g. "2026-08-20"
  priority?: CardPriority;
  assignee_ids?: string[]; // profiles.id
  labels?: string[];
}

export interface Card {
  id: string;
  column_id: string;
  title: string;
  description: string | null;
  position: number;
  metadata: CardMetadata;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CardInsert {
  column_id: string;
  title: string;
  description?: string | null;
  position: number;
  metadata?: CardMetadata;
  created_by: string;
}

export interface CardUpdate {
  column_id?: string; // moving a card to another column (drag & drop)
  title?: string;
  description?: string | null;
  position?: number;
  metadata?: CardMetadata;
}

// ---------------------------------------------------------------------------
// checklists / checklist_items
// ---------------------------------------------------------------------------

export interface Checklist {
  id: string;
  card_id: string;
  title: string;
  position: number;
  created_at: string;
}

export interface ChecklistInsert {
  card_id: string;
  title: string;
  position: number;
}

export interface ChecklistUpdate {
  title?: string;
  position?: number;
}

export interface ChecklistItem {
  id: string;
  checklist_id: string;
  text: string;
  done: boolean;
  position: number;
  created_at: string;
}

export interface ChecklistItemInsert {
  checklist_id: string;
  text: string;
  done?: boolean;
  position: number;
}

export interface ChecklistItemUpdate {
  text?: string;
  done?: boolean;
  position?: number;
}

// ---------------------------------------------------------------------------
// comments
// ---------------------------------------------------------------------------

export interface Comment {
  id: string;
  card_id: string;
  user_id: string;
  text: string;
  created_at: string;
  updated_at: string;
}

export interface CommentInsert {
  card_id: string;
  user_id: string;
  text: string;
}

export interface CommentUpdate {
  text?: string;
}

// ---------------------------------------------------------------------------
// attachments — storage_path always "{workspace_id}/{card_id}/{file_name}",
// enforced by the storage.objects RLS policies in 0004_storage.sql.
// ---------------------------------------------------------------------------

export interface Attachment {
  id: string;
  card_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface AttachmentInsert {
  card_id: string;
  storage_path: string;
  file_name: string;
  mime_type?: string | null;
  size_bytes?: number | null;
  uploaded_by: string;
}

// ---------------------------------------------------------------------------
// Database — pass to createClient<Database>() from @supabase/supabase-js
// for a fully typed client without running `supabase gen types`.
// ---------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: never; // created only by the on_auth_user_created trigger
        Update: ProfileUpdate;
      };
      workspaces: {
        Row: Workspace;
        Insert: WorkspaceInsert;
        Update: WorkspaceUpdate;
      };
      teams: {
        Row: Team;
        Insert: TeamInsert;
        Update: TeamUpdate;
      };
      memberships: {
        Row: Membership;
        Insert: never; // created by invite_member()/accept_pending_invites()
        Update: MembershipUpdate;
      };
      workspace_invites: {
        Row: WorkspaceInvite;
        Insert: never; // created only by invite_member()
        Update: never;
      };
      boards: {
        Row: Board;
        Insert: BoardInsert;
        Update: BoardUpdate;
      };
      board_columns: {
        Row: BoardColumn;
        Insert: BoardColumnInsert;
        Update: BoardColumnUpdate;
      };
      cards: {
        Row: Card;
        Insert: CardInsert;
        Update: CardUpdate;
      };
      checklists: {
        Row: Checklist;
        Insert: ChecklistInsert;
        Update: ChecklistUpdate;
      };
      checklist_items: {
        Row: ChecklistItem;
        Insert: ChecklistItemInsert;
        Update: ChecklistItemUpdate;
      };
      comments: {
        Row: Comment;
        Insert: CommentInsert;
        Update: CommentUpdate;
      };
      attachments: {
        Row: Attachment;
        Insert: AttachmentInsert;
        Update: never; // attachments are replaced (delete + upload), not edited
      };
    };
    Functions: {
      invite_member: {
        Args: {
          p_workspace_id: string;
          p_email: string;
          p_role?: InviteRole;
        };
        Returns: InviteOutcome;
      };
    };
  };
}
