-- ============================================================================
-- Truvornex Engineering Workspace - Supabase Schema (Run 1 of 3)
-- Target: Supabase SQL Editor (PostgreSQL 15+)
-- Idempotent: Safe to re-run without dropping existing data.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Workspace Configuration (Strict 8-account ceiling & console isolation)
CREATE TABLE IF NOT EXISTS public.workspaces (
  id text PRIMARY KEY,
  name text NOT NULL,
  programme_title text NOT NULL,
  default_timezone text NOT NULL DEFAULT 'UTC',
  enforce_mfa boolean NOT NULL DEFAULT true,
  operator_console_isolated boolean NOT NULL DEFAULT true CHECK (operator_console_isolated = true),
  operator_seat_limit integer NOT NULL DEFAULT 0 CHECK (operator_seat_limit = 0),
  max_account_slots integer NOT NULL DEFAULT 8 CHECK (max_account_slots = 8),
  allow_auto_join boolean NOT NULL DEFAULT false,
  notification_prefs jsonb NOT NULL DEFAULT '{"batchLowPriority": true, "emailDigest": false, "chatDeepLinks": true}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Account Directory (Strictly max 8 non-revoked accounts)
CREATE TABLE IF NOT EXISTS public.workspace_accounts (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE DEFAULT 'ws-truvornex',
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  idp_subject text UNIQUE NOT NULL,
  auth_provider text NOT NULL DEFAULT 'supabase' CHECK (auth_provider IN ('firebase', 'supabase')),
  display_name text NOT NULL,
  email text NOT NULL UNIQUE CHECK (email = lower(trim(email))),
  title text NOT NULL DEFAULT 'Engineer',
  role text NOT NULL CHECK (
    role IN (
      'Workspace Owner',
      'Workspace Administrator',
      'Programme Manager',
      'Project Manager',
      'Team Lead',
      'Contributor',
      'Reviewer / QA',
      'Read-only Observer',
      'External Collaborator'
    )
  ),
  state text NOT NULL DEFAULT 'invited' CHECK (state IN ('active', 'suspended', 'invited', 'revoked')),
  mfa_enabled boolean NOT NULL DEFAULT true,
  timezone text NOT NULL DEFAULT 'UTC',
  presence text NOT NULL DEFAULT 'active' CHECK (presence IN ('active', 'focus', 'reviewing', 'away')),
  chat_notification_mode text NOT NULL DEFAULT 'mentions_only' CHECK (chat_notification_mode IN ('mentions_only', 'all_messages', 'muted')),
  notify_on_channel_all boolean NOT NULL DEFAULT true,
  desktop_alerts boolean NOT NULL DEFAULT false,
  channel_notification_modes jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_workspace_accounts_email ON public.workspace_accounts (email);
CREATE INDEX IF NOT EXISTS idx_workspace_accounts_auth_uid ON public.workspace_accounts (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_accounts_state ON public.workspace_accounts (state);

-- 3. Private Keyfile Hashes (Zero client exposure via RLS; service_role only)
CREATE TABLE IF NOT EXISTS public.account_keyfiles (
  id text PRIMARY KEY,
  account_id text UNIQUE REFERENCES public.workspace_accounts(id) ON DELETE CASCADE,
  is_workspace_master boolean NOT NULL DEFAULT false,
  keyfile_sha256 text NOT NULL CHECK (keyfile_sha256 ~ '^[a-f0-9]{64}$'),
  issued_by text NULL REFERENCES public.workspace_accounts(id) ON DELETE SET NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_keyfiles_single_master
  ON public.account_keyfiles (is_workspace_master)
  WHERE is_workspace_master = true;

-- 4. Invites & Revoked Token JTIs
CREATE TABLE IF NOT EXISTS public.workspace_invites (
  id text PRIMARY KEY,
  email text NOT NULL CHECK (email = lower(trim(email))),
  display_name text NOT NULL,
  role text NOT NULL,
  title text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  invited_by text REFERENCES public.workspace_accounts(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.revoked_tokens (
  jti text PRIMARY KEY,
  account_id text REFERENCES public.workspace_accounts(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Divisions & Teams
CREATE TABLE IF NOT EXISTS public.divisions (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  lead_id text REFERENCES public.workspace_accounts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.teams (
  id text PRIMARY KEY,
  division_id text NOT NULL REFERENCES public.divisions(id) ON DELETE CASCADE,
  name text NOT NULL,
  lead_id text REFERENCES public.workspace_accounts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.team_members (
  team_id text NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  account_id text NOT NULL REFERENCES public.workspace_accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, account_id)
);

-- 6. Projects & Membership
CREATE TABLE IF NOT EXISTS public.projects (
  id text PRIMARY KEY,
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  programme text NOT NULL,
  objective text NOT NULL DEFAULT '',
  owner_id text REFERENCES public.workspace_accounts(id) ON DELETE SET NULL,
  sponsor_id text REFERENCES public.workspace_accounts(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Planning', 'On Hold', 'Archived')),
  health text NOT NULL DEFAULT 'on_track' CHECK (health IN ('on_track', 'at_risk', 'off_track')),
  health_note text NOT NULL DEFAULT '',
  visibility text NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal', 'restricted')),
  start_date date NOT NULL,
  target_date date NOT NULL,
  participating_team_ids text[] NOT NULL DEFAULT '{}'::text[],
  linked_doc_ids text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_members (
  project_id text NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  account_id text NOT NULL REFERENCES public.workspace_accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, account_id)
);

-- 7. Milestones & Work Packages
CREATE TABLE IF NOT EXISTS public.milestones (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  target_window text NOT NULL,
  target_date date NOT NULL,
  state text NOT NULL DEFAULT 'Planned' CHECK (state IN ('Planned', 'At Risk', 'Achieved', 'Missed')),
  confidence integer NOT NULL DEFAULT 75 CHECK (confidence >= 0 AND confidence <= 100),
  owner_id text REFERENCES public.workspace_accounts(id) ON DELETE SET NULL,
  description text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.work_packages (
  id text PRIMARY KEY,
  key text NOT NULL UNIQUE,
  project_id text NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_id text NULL REFERENCES public.work_packages(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('initiative', 'epic', 'feature', 'task', 'subtask', 'bug', 'research', 'tech_debt')),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Draft' CHECK (
    status IN (
      'Draft', 'Backlog', 'Ready', 'In Progress', 'In Review',
      'Verification', 'Accepted', 'Closed', 'Blocked', 'Waiting', 'Cancelled', 'Reopened'
    )
  ),
  priority text NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Critical', 'High', 'Medium', 'Low')),
  owner_id text REFERENCES public.workspace_accounts(id) ON DELETE SET NULL,
  reviewer_id text NULL REFERENCES public.workspace_accounts(id) ON DELETE SET NULL,
  creator_id text REFERENCES public.workspace_accounts(id) ON DELETE SET NULL,
  team_id text NULL REFERENCES public.teams(id) ON DELETE SET NULL,
  milestone_id text NULL REFERENCES public.milestones(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  due_date date NOT NULL,
  estimate_hours numeric(8, 2) NOT NULL DEFAULT 0,
  labels text[] NOT NULL DEFAULT '{}'::text[],
  acceptance_criteria text NOT NULL DEFAULT '',
  dependencies_confirmed_none boolean NOT NULL DEFAULT false,
  blocker_reason text NULL,
  blocker_owner_id text NULL REFERENCES public.workspace_accounts(id) ON DELETE SET NULL,
  next_review_date date NULL,
  blocker_exception_reason text NULL,
  evidence_note text NULL,
  high_risk boolean NOT NULL DEFAULT false,
  security_approved_by text NULL REFERENCES public.workspace_accounts(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_packages_project ON public.work_packages (project_id);
CREATE INDEX IF NOT EXISTS idx_work_packages_status ON public.work_packages (status);

CREATE TABLE IF NOT EXISTS public.work_package_assignees (
  work_package_id text NOT NULL REFERENCES public.work_packages(id) ON DELETE CASCADE,
  account_id text NOT NULL REFERENCES public.workspace_accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (work_package_id, account_id)
);

CREATE TABLE IF NOT EXISTS public.work_dependencies (
  id text PRIMARY KEY,
  predecessor_id text NOT NULL REFERENCES public.work_packages(id) ON DELETE CASCADE,
  successor_id text NOT NULL REFERENCES public.work_packages(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('blocks', 'relates_to')),
  UNIQUE (predecessor_id, successor_id, type),
  CHECK (predecessor_id <> successor_id)
);

CREATE TABLE IF NOT EXISTS public.work_field_history (
  id text PRIMARY KEY,
  work_package_id text NOT NULL REFERENCES public.work_packages(id) ON DELETE CASCADE,
  field text NOT NULL,
  old_value text NOT NULL,
  new_value text NOT NULL,
  actor_id text REFERENCES public.workspace_accounts(id) ON DELETE SET NULL,
  timestamp timestamptz NOT NULL DEFAULT now()
);

-- 8. Knowledge, Comments, and Attachments
CREATE TABLE IF NOT EXISTS public.documents (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  project_id text NULL REFERENCES public.projects(id) ON DELETE SET NULL,
  category text NOT NULL CHECK (category IN ('ADR', 'RFC', 'Specification', 'Runbook', 'Announcement')),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'In Review', 'Accepted', 'Published', 'Superseded')),
  owner_id text REFERENCES public.workspace_accounts(id) ON DELETE SET NULL,
  labels text[] NOT NULL DEFAULT '{}'::text[],
  version integer NOT NULL DEFAULT 1,
  restricted boolean NOT NULL DEFAULT false,
  linked_work_ids text[] NOT NULL DEFAULT '{}'::text[],
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.document_versions (
  id text PRIMARY KEY,
  document_id text NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version integer NOT NULL,
  body text NOT NULL,
  editor_id text REFERENCES public.workspace_accounts(id) ON DELETE SET NULL,
  summary text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, version)
);

CREATE TABLE IF NOT EXISTS public.comments (
  id text PRIMARY KEY,
  resource_type text NOT NULL CHECK (resource_type IN ('work_package', 'document')),
  resource_id text NOT NULL,
  author_id text REFERENCES public.workspace_accounts(id) ON DELETE SET NULL,
  body text NOT NULL,
  mentions text[] NOT NULL DEFAULT '{}'::text[],
  reactions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attachments (
  id text PRIMARY KEY,
  parent_type text NOT NULL CHECK (parent_type IN ('work_package', 'document')),
  parent_id text NOT NULL,
  project_id text NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  media_type text NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes > 0),
  checksum_sha256 text NOT NULL,
  uploaded_by text REFERENCES public.workspace_accounts(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  storage_key text NOT NULL
);

-- 9. Workspace Chat & Mention/All-Message Notification Routing
CREATE TABLE IF NOT EXISTS public.chat_channels (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  topic text NOT NULL DEFAULT '',
  project_id text NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  is_private boolean NOT NULL DEFAULT false,
  created_by text REFERENCES public.workspace_accounts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_channel_members (
  channel_id text NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  account_id text NOT NULL REFERENCES public.workspace_accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (channel_id, account_id)
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id text PRIMARY KEY,
  channel_id text NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  author_id text NOT NULL REFERENCES public.workspace_accounts(id) ON DELETE CASCADE,
  parent_message_id text NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  body text NOT NULL,
  mentions text[] NOT NULL DEFAULT '{}'::text[],
  mention_all boolean NOT NULL DEFAULT false,
  reactions jsonb NOT NULL DEFAULT '{}'::jsonb,
  pinned boolean NOT NULL DEFAULT false,
  edited boolean NOT NULL DEFAULT false,
  linked_work_key text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_created
  ON public.chat_messages (channel_id, created_at DESC);

-- 10. Notifications, Audit Trail, Activity, Meetings, Saved Views, Integrations
CREATE TABLE IF NOT EXISTS public.notifications (
  id text PRIMARY KEY,
  recipient_id text NOT NULL REFERENCES public.workspace_accounts(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (
    category IN ('assignment', 'mention', 'review', 'blocker', 'access', 'integration', 'announcement', 'chat')
  ),
  title text NOT NULL,
  summary text NOT NULL,
  resource_type text NULL CHECK (
    resource_type IN ('work_package', 'project', 'document', 'integration', 'member', 'chat_channel')
  ),
  resource_id text NULL,
  security_critical boolean NOT NULL DEFAULT false,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON public.notifications (recipient_id, read, created_at DESC);

CREATE TABLE IF NOT EXISTS public.audit_events (
  id text PRIMARY KEY,
  correlation_id text NOT NULL,
  actor_id text NOT NULL,
  actor_name text NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  result text NOT NULL CHECK (result IN ('success', 'denied')),
  details text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_timestamp ON public.audit_events (timestamp DESC);

CREATE TABLE IF NOT EXISTS public.activity_events (
  id text PRIMARY KEY,
  actor_id text REFERENCES public.workspace_accounts(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL CHECK (
    resource_type IN ('work_package', 'project', 'document', 'milestone', 'integration')
  ),
  resource_id text NOT NULL,
  resource_key text NULL,
  resource_title text NOT NULL,
  project_id text NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  summary text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.meetings (
  id text PRIMARY KEY,
  project_id text NULL REFERENCES public.projects(id) ON DELETE SET NULL,
  title text NOT NULL,
  date date NOT NULL,
  time_range text NOT NULL,
  facilitator_id text REFERENCES public.workspace_accounts(id) ON DELETE SET NULL,
  channel_ref text NOT NULL DEFAULT '',
  agenda_summary text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.saved_views (
  id text PRIMARY KEY,
  name text NOT NULL,
  owner_id text NOT NULL REFERENCES public.workspace_accounts(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('workspace', 'project')),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.integrations (
  id text PRIMARY KEY,
  provider text NOT NULL CHECK (provider IN ('gitlab', 'mattermost', 'oidc', 's3')),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Connected' CHECK (status IN ('Connected', 'Degraded', 'Disabled')),
  enabled boolean NOT NULL DEFAULT true,
  secret_ref text NOT NULL,
  webhook_secret_set boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz NOT NULL DEFAULT now(),
  endpoint_url text NOT NULL DEFAULT '',
  scope_note text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.external_links (
  id text PRIMARY KEY,
  work_package_id text NULL REFERENCES public.work_packages(id) ON DELETE CASCADE,
  project_id text NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('gitlab', 'mattermost')),
  kind text NOT NULL CHECK (kind IN ('repository', 'branch', 'merge_request', 'pipeline', 'release', 'channel')),
  external_id text NOT NULL,
  title text NOT NULL,
  status text NOT NULL,
  url text NOT NULL,
  author_name text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.processed_webhooks (
  id text PRIMARY KEY,
  provider text NOT NULL,
  delivery_id text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, delivery_id)
);
