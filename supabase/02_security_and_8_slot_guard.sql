-- ============================================================================
-- Truvornex Engineering Workspace - Security, 8-Slot Guard & RLS (Run 2 of 3)
-- Target: Supabase SQL Editor (PostgreSQL 15+)
-- ============================================================================

-- 1. Helper functions (SECURITY DEFINER avoids RLS recursion on workspace_accounts)
CREATE OR REPLACE FUNCTION public.current_workspace_account()
RETURNS public.workspace_accounts
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT wa.*
  FROM public.workspace_accounts wa
  WHERE (
    wa.auth_user_id = auth.uid()
    OR ((auth.jwt() ->> 'email') IS NOT NULL AND wa.email = lower(trim(auth.jwt() ->> 'email')))
  )
    AND wa.state = 'active'
    AND (wa.expires_at IS NULL OR wa.expires_at > now())
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_accounts wa
    WHERE (
      wa.auth_user_id = auth.uid()
      OR ((auth.jwt() ->> 'email') IS NOT NULL AND wa.email = lower(trim(auth.jwt() ->> 'email')))
    )
      AND wa.state = 'active'
      AND (wa.expires_at IS NULL OR wa.expires_at > now())
      AND wa.role IN ('Workspace Owner', 'Workspace Administrator')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_project(target_project_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    CROSS JOIN LATERAL public.current_workspace_account() me
    WHERE p.id = target_project_id
      AND (
        (p.visibility = 'internal' AND me.role <> 'External Collaborator')
        OR me.role = 'Workspace Owner'
        OR EXISTS (
          SELECT 1
          FROM public.project_members pm
          WHERE pm.project_id = p.id AND pm.account_id = me.id
        )
      )
  );
$$;

-- 2. Strict 8-Account Slot Ceiling Trigger (Atomic with Advisory Lock)
CREATE OR REPLACE FUNCTION public.enforce_max_8_account_slots()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_slots integer;
BEGIN
  -- Normalize email
  NEW.email := lower(trim(NEW.email));

  -- Serialize concurrent slot writes across transactions
  PERFORM pg_advisory_xact_lock(hashtext('truvornex_account_slots'));

  IF NEW.state <> 'revoked' THEN
    SELECT count(*)
    INTO active_slots
    FROM public.workspace_accounts
    WHERE state <> 'revoked'
      AND id <> COALESCE(NEW.id, '');

    IF active_slots >= 8 THEN
      RAISE EXCEPTION 'Workspace account capacity reached (8/8 slots occupied). Remove or revoke an existing account first.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Prevent demoting or revoking the sole active Workspace Owner
  IF TG_OP = 'UPDATE' AND OLD.role = 'Workspace Owner' AND OLD.state = 'active' THEN
    IF NEW.role <> 'Workspace Owner' OR NEW.state <> 'active' THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.workspace_accounts
        WHERE role = 'Workspace Owner'
          AND state = 'active'
          AND id <> OLD.id
      ) THEN
        RAISE EXCEPTION 'Cannot demote or suspend the sole active Workspace Owner.'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_max_8_account_slots ON public.workspace_accounts;
CREATE TRIGGER trg_enforce_max_8_account_slots
  BEFORE INSERT OR UPDATE ON public.workspace_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_max_8_account_slots();

-- 3. Automatic Timestamp Maintenance
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER trg_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_work_packages_updated_at ON public.work_packages;
CREATE TRIGGER trg_work_packages_updated_at
  BEFORE UPDATE ON public.work_packages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_chat_messages_updated_at ON public.chat_messages;
CREATE TRIGGER trg_chat_messages_updated_at
  BEFORE UPDATE ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Link Pre-Provisioned Supabase Auth Users Without Allowing Open Self-Signup
-- When you create an account in Supabase Dashboard -> Auth -> Users, if its email
-- is pre-authorized in workspace_accounts, bind auth_user_id automatically and
-- mark invited slots as active.
CREATE OR REPLACE FUNCTION public.bind_supabase_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  normalized_email text;
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;
  normalized_email := lower(trim(NEW.email));

  UPDATE public.workspace_accounts
  SET
    auth_user_id = NEW.id,
    auth_provider = 'supabase',
    idp_subject = 'supabase|' || NEW.id::text,
    state = CASE WHEN state = 'invited' THEN 'active' ELSE state END,
    last_active_at = now()
  WHERE email = normalized_email
    AND state <> 'revoked';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bind_supabase_auth_user ON auth.users;
CREATE TRIGGER trg_bind_supabase_auth_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.bind_supabase_auth_user();

-- 5. Server-Side Chat Notification Routing (mentions_only vs all_messages vs muted)
CREATE OR REPLACE FUNCTION public.route_chat_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ch record;
  acct record;
  effective_mode text;
  is_mentioned boolean;
  author_name text;
BEGIN
  SELECT * INTO ch FROM public.chat_channels WHERE id = NEW.channel_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT display_name INTO author_name
  FROM public.workspace_accounts
  WHERE id = NEW.author_id;

  FOR acct IN
    SELECT *
    FROM public.workspace_accounts
    WHERE state = 'active'
      AND id <> NEW.author_id
      AND (expires_at IS NULL OR expires_at > now())
  LOOP
    -- Respect private channel membership
    IF ch.is_private AND acct.role NOT IN ('Workspace Owner', 'Workspace Administrator') THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.chat_channel_members m
        WHERE m.channel_id = ch.id AND m.account_id = acct.id
      ) AND ch.created_by <> acct.id THEN
        CONTINUE;
      END IF;
    END IF;

    -- Respect restricted project scope
    IF ch.project_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = ch.project_id
          AND (
            (p.visibility = 'internal' AND acct.role <> 'External Collaborator')
            OR acct.role = 'Workspace Owner'
            OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.account_id = acct.id)
          )
      ) THEN
        CONTINUE;
      END IF;
    END IF;

    effective_mode := COALESCE(
      acct.channel_notification_modes ->> ch.id,
      acct.chat_notification_mode,
      'mentions_only'
    );

    IF effective_mode = 'muted' THEN
      CONTINUE;
    END IF;

    is_mentioned := (acct.id = ANY(NEW.mentions)) OR (NEW.mention_all AND acct.notify_on_channel_all);

    IF effective_mode = 'all_messages' OR is_mentioned THEN
      INSERT INTO public.notifications (
        id, recipient_id, category, title, summary, resource_type, resource_id, security_critical, read
      )
      VALUES (
        'ntf-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
        acct.id,
        CASE WHEN is_mentioned THEN 'mention' ELSE 'chat' END,
        CASE
          WHEN is_mentioned THEN COALESCE(author_name, 'Teammate') || ' mentioned you in #' || ch.name
          ELSE 'New message from ' || COALESCE(author_name, 'Teammate') || ' in #' || ch.name
        END,
        left(NEW.body, 160),
        'chat_channel',
        ch.id,
        false,
        false
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_route_chat_notifications ON public.chat_messages;
CREATE TRIGGER trg_route_chat_notifications
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.route_chat_notifications();

-- 6. Enable Row Level Security (RLS) on All Tables
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_keyfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revoked_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_package_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_field_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_webhooks ENABLE ROW LEVEL SECURITY;

-- Note: account_keyfiles, revoked_tokens, and processed_webhooks intentionally have NO client
-- policies so anon/authenticated users can NEVER read SHA-256 keyfile hashes or webhook state.
-- Only service_role / backend server code accesses them.

-- Workspaces policies
DROP POLICY IF EXISTS workspaces_select ON public.workspaces;
CREATE POLICY workspaces_select ON public.workspaces
  FOR SELECT TO authenticated
  USING ((public.current_workspace_account()).id IS NOT NULL);

DROP POLICY IF EXISTS workspaces_admin_update ON public.workspaces;
CREATE POLICY workspaces_admin_update ON public.workspaces
  FOR UPDATE TO authenticated
  USING (public.is_workspace_admin())
  WITH CHECK (public.is_workspace_admin() AND max_account_slots = 8 AND operator_console_isolated = true);

-- Workspace Accounts policies
DROP POLICY IF EXISTS accounts_select ON public.workspace_accounts;
CREATE POLICY accounts_select ON public.workspace_accounts
  FOR SELECT TO authenticated
  USING ((public.current_workspace_account()).id IS NOT NULL);

DROP POLICY IF EXISTS accounts_self_prefs_update ON public.workspace_accounts;
CREATE POLICY accounts_self_prefs_update ON public.workspace_accounts
  FOR UPDATE TO authenticated
  USING (id = (public.current_workspace_account()).id OR public.is_workspace_admin())
  WITH CHECK (
    public.is_workspace_admin()
    OR (
      id = (public.current_workspace_account()).id
      AND role = (public.current_workspace_account()).role
      AND state = (public.current_workspace_account()).state
    )
  );

DROP POLICY IF EXISTS accounts_admin_insert ON public.workspace_accounts;
CREATE POLICY accounts_admin_insert ON public.workspace_accounts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_admin());

DROP POLICY IF EXISTS accounts_admin_delete ON public.workspace_accounts;
CREATE POLICY accounts_admin_delete ON public.workspace_accounts
  FOR DELETE TO authenticated
  USING (public.is_workspace_admin() AND role <> 'Workspace Owner');

-- Invites (Admin only)
DROP POLICY IF EXISTS invites_admin_all ON public.workspace_invites;
CREATE POLICY invites_admin_all ON public.workspace_invites
  FOR ALL TO authenticated
  USING (public.is_workspace_admin())
  WITH CHECK (public.is_workspace_admin());

-- Divisions & Teams (Read by active workspace members, managed by admins)
DROP POLICY IF EXISTS divisions_select ON public.divisions;
CREATE POLICY divisions_select ON public.divisions
  FOR SELECT TO authenticated
  USING ((public.current_workspace_account()).id IS NOT NULL);

DROP POLICY IF EXISTS teams_select ON public.teams;
CREATE POLICY teams_select ON public.teams
  FOR SELECT TO authenticated
  USING ((public.current_workspace_account()).id IS NOT NULL);

DROP POLICY IF EXISTS team_members_select ON public.team_members;
CREATE POLICY team_members_select ON public.team_members
  FOR SELECT TO authenticated
  USING ((public.current_workspace_account()).id IS NOT NULL);

-- Projects & Members
DROP POLICY IF EXISTS projects_select ON public.projects;
CREATE POLICY projects_select ON public.projects
  FOR SELECT TO authenticated
  USING (public.can_view_project(id));

DROP POLICY IF EXISTS projects_manage ON public.projects;
CREATE POLICY projects_manage ON public.projects
  FOR ALL TO authenticated
  USING ((public.current_workspace_account()).role IN ('Workspace Owner', 'Workspace Administrator', 'Programme Manager', 'Project Manager'))
  WITH CHECK ((public.current_workspace_account()).role IN ('Workspace Owner', 'Workspace Administrator', 'Programme Manager', 'Project Manager'));

DROP POLICY IF EXISTS project_members_select ON public.project_members;
CREATE POLICY project_members_select ON public.project_members
  FOR SELECT TO authenticated
  USING (public.can_view_project(project_id));

-- Milestones & Work Packages scoped to visible projects
DROP POLICY IF EXISTS milestones_select ON public.milestones;
CREATE POLICY milestones_select ON public.milestones
  FOR SELECT TO authenticated
  USING (public.can_view_project(project_id));

DROP POLICY IF EXISTS work_packages_select ON public.work_packages;
CREATE POLICY work_packages_select ON public.work_packages
  FOR SELECT TO authenticated
  USING (public.can_view_project(project_id));

DROP POLICY IF EXISTS work_packages_write ON public.work_packages;
CREATE POLICY work_packages_write ON public.work_packages
  FOR ALL TO authenticated
  USING (
    public.can_view_project(project_id)
    AND (public.current_workspace_account()).role <> 'Read-only Observer'
  )
  WITH CHECK (
    public.can_view_project(project_id)
    AND (public.current_workspace_account()).role <> 'Read-only Observer'
  );

DROP POLICY IF EXISTS wp_assignees_select ON public.work_package_assignees;
CREATE POLICY wp_assignees_select ON public.work_package_assignees
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.work_packages wp
      WHERE wp.id = work_package_id AND public.can_view_project(wp.project_id)
    )
  );

DROP POLICY IF EXISTS work_deps_select ON public.work_dependencies;
CREATE POLICY work_deps_select ON public.work_dependencies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.work_packages wp
      WHERE wp.id = predecessor_id AND public.can_view_project(wp.project_id)
    )
  );

DROP POLICY IF EXISTS work_history_select ON public.work_field_history;
CREATE POLICY work_history_select ON public.work_field_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.work_packages wp
      WHERE wp.id = work_package_id AND public.can_view_project(wp.project_id)
    )
  );

-- Documents & Versions
DROP POLICY IF EXISTS documents_select ON public.documents;
CREATE POLICY documents_select ON public.documents
  FOR SELECT TO authenticated
  USING (
    (project_id IS NULL OR public.can_view_project(project_id))
    AND (
      restricted = false
      OR (public.current_workspace_account()).role = 'Workspace Owner'
      OR (
        (public.current_workspace_account()).role <> 'External Collaborator'
        AND (
          public.is_workspace_admin()
          OR owner_id = (public.current_workspace_account()).id
          OR (project_id IS NOT NULL AND public.can_view_project(project_id))
        )
      )
    )
  );

DROP POLICY IF EXISTS doc_versions_select ON public.document_versions;
CREATE POLICY doc_versions_select ON public.document_versions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id)
  );

DROP POLICY IF EXISTS comments_select ON public.comments;
CREATE POLICY comments_select ON public.comments
  FOR SELECT TO authenticated
  USING ((public.current_workspace_account()).id IS NOT NULL);

DROP POLICY IF EXISTS attachments_select ON public.attachments;
CREATE POLICY attachments_select ON public.attachments
  FOR SELECT TO authenticated
  USING (public.can_view_project(project_id));

-- Chat Channels & Messages
DROP POLICY IF EXISTS chat_channels_select ON public.chat_channels;
CREATE POLICY chat_channels_select ON public.chat_channels
  FOR SELECT TO authenticated
  USING (
    (project_id IS NULL OR public.can_view_project(project_id))
    AND (
      is_private = false
      OR public.is_workspace_admin()
      OR created_by = (public.current_workspace_account()).id
      OR EXISTS (
        SELECT 1 FROM public.chat_channel_members m
        WHERE m.channel_id = chat_channels.id AND m.account_id = (public.current_workspace_account()).id
      )
    )
  );

DROP POLICY IF EXISTS chat_channel_members_select ON public.chat_channel_members;
CREATE POLICY chat_channel_members_select ON public.chat_channel_members
  FOR SELECT TO authenticated
  USING ((public.current_workspace_account()).id IS NOT NULL);

DROP POLICY IF EXISTS chat_messages_select ON public.chat_messages;
CREATE POLICY chat_messages_select ON public.chat_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.chat_channels c WHERE c.id = channel_id)
  );

DROP POLICY IF EXISTS chat_messages_insert ON public.chat_messages;
CREATE POLICY chat_messages_insert ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = (public.current_workspace_account()).id
    AND (public.current_workspace_account()).role <> 'Read-only Observer'
  );

-- Notifications (Users see their own; Admins see all)
DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT TO authenticated
  USING (recipient_id = (public.current_workspace_account()).id OR public.is_workspace_admin());

DROP POLICY IF EXISTS notifications_update ON public.notifications;
CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (recipient_id = (public.current_workspace_account()).id OR public.is_workspace_admin());

-- Audit Events (Admins & Programme Managers only)
DROP POLICY IF EXISTS audit_events_select ON public.audit_events;
CREATE POLICY audit_events_select ON public.audit_events
  FOR SELECT TO authenticated
  USING ((public.current_workspace_account()).role IN ('Workspace Owner', 'Workspace Administrator', 'Programme Manager'));

-- Activity, Meetings, Saved Views, Integrations, External Links
DROP POLICY IF EXISTS activity_select ON public.activity_events;
CREATE POLICY activity_select ON public.activity_events
  FOR SELECT TO authenticated
  USING (project_id IS NULL OR public.can_view_project(project_id));

DROP POLICY IF EXISTS meetings_select ON public.meetings;
CREATE POLICY meetings_select ON public.meetings
  FOR SELECT TO authenticated
  USING (project_id IS NULL OR public.can_view_project(project_id));

DROP POLICY IF EXISTS saved_views_own ON public.saved_views;
CREATE POLICY saved_views_own ON public.saved_views
  FOR ALL TO authenticated
  USING (owner_id = (public.current_workspace_account()).id)
  WITH CHECK (owner_id = (public.current_workspace_account()).id);

DROP POLICY IF EXISTS integrations_select ON public.integrations;
CREATE POLICY integrations_select ON public.integrations
  FOR SELECT TO authenticated
  USING ((public.current_workspace_account()).role <> 'External Collaborator');

DROP POLICY IF EXISTS external_links_select ON public.external_links;
CREATE POLICY external_links_select ON public.external_links
  FOR SELECT TO authenticated
  USING (public.can_view_project(project_id));
