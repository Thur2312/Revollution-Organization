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
  company: string | null;
  is_platform_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProfileUpdate {
  full_name?: string | null;
  avatar_url?: string | null;
  company?: string | null;
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
// workspace_invites — see invite_member() in 0005_invites.sql (rewritten in
// 0011_open_signup_invites.sql to always stay pending; membership is only
// ever created by the invitee calling accept_workspace_invite()). Never
// inserted directly by the client.
// ---------------------------------------------------------------------------

export type InviteRole = Exclude<MemberRole, 'owner'>;
// 'existing' — invitee already has an account, will see this in their inbox.
// 'new' — invitee doesn't have an account yet, needs the invite email.
export type InviteOutcome = 'existing' | 'new';

export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  email: string;
  role: InviteRole;
  invited_by: string;
  accepted_at: string | null;
  created_at: string;
}

export interface PendingInviteRow {
  id: string;
  workspace_id: string;
  workspace_name: string;
  role: InviteRole;
  invited_by_name: string;
  created_at: string;
}

export interface UserSearchResult {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

// ---------------------------------------------------------------------------
// boards
// ---------------------------------------------------------------------------

export type BoardKind = 'kanban' | 'crm';
export type BoardColor = 'accent' | 'rose' | 'amber' | 'emerald' | 'sky' | 'violet' | 'slate';

export interface Board {
  id: string;
  workspace_id: string;
  team_id: string | null;
  name: string;
  kind: BoardKind;
  color: BoardColor;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BoardInsert {
  workspace_id: string;
  team_id?: string | null;
  name: string;
  kind?: BoardKind;
  color?: BoardColor;
  created_by: string;
}

export interface BoardUpdate {
  name?: string;
  team_id?: string | null;
  color?: BoardColor;
}

// ---------------------------------------------------------------------------
// board_columns
// ---------------------------------------------------------------------------

export interface BoardColumn {
  id: string;
  board_id: string;
  name: string;
  position: number;
  celebrate_on_card: boolean;
  color: BoardColor | null;
  created_at: string;
}

export interface BoardColumnInsert {
  board_id: string;
  name: string;
  position: number;
  celebrate_on_card?: boolean;
  color?: BoardColor | null;
}

export interface BoardColumnUpdate {
  name?: string;
  position?: number;
  color?: BoardColor | null;
  celebrate_on_card?: boolean;
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
  // CRM board cards only — set on manual edit and on spreadsheet import.
  // The client's name lives in cards.title itself, not here.
  client_phone?: string;
  client_email?: string;
  proposal_value?: number;
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

export type NotificationType = 'card_assigned' | 'card_commented' | 'card_mentioned';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  card_id: string | null;
  actor_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationUpdate {
  read_at?: string | null;
}

export type CardActivityAction =
  | 'created'
  | 'moved'
  | 'renamed'
  | 'priority_changed'
  | 'due_date_changed'
  | 'assignee_added'
  | 'assignee_removed';

export interface CardActivity {
  id: string;
  card_id: string;
  actor_id: string | null;
  action: CardActivityAction;
  detail: Record<string, string | null>;
  created_at: string;
}

// ---------------------------------------------------------------------------
// time_entries — one row per user per calendar day, managed by the client
// session heartbeat (see src/components/TimesheetHeartbeat.tsx).
// ---------------------------------------------------------------------------

export interface TimeEntry {
  id: string;
  user_id: string;
  work_date: string;
  started_at: string;
  last_seen_at: string;
  ended_at: string | null;
}

export interface TimeEntryInsert {
  user_id: string;
  work_date: string;
}

export interface TimeEntryUpdate {
  last_seen_at?: string;
  ended_at?: string | null;
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
      notifications: {
        Row: Notification;
        Insert: never; // created only by the notify_* triggers
        Update: NotificationUpdate;
      };
      card_activity: {
        Row: CardActivity;
        Insert: never; // created only by the log_card_* triggers
        Update: never;
      };
      time_entries: {
        Row: TimeEntry;
        Insert: TimeEntryInsert;
        Update: TimeEntryUpdate;
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
      accept_workspace_invite: {
        Args: { p_invite_id: string };
        Returns: string; // workspace_id
      };
      decline_workspace_invite: {
        Args: { p_invite_id: string };
        Returns: void;
      };
      my_pending_invites: {
        Args: Record<string, never>;
        Returns: PendingInviteRow[];
      };
      search_users_by_email: {
        Args: { p_query: string };
        Returns: UserSearchResult[];
      };
    };
  };
}
