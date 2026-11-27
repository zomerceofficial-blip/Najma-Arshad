-- ============================================================================
-- Truvornex Engineering Workspace - Initial Seed & 8-Account Setup (Run 3 of 3)
-- Target: Supabase SQL Editor (PostgreSQL 15+)
-- Idempotent: Uses ON CONFLICT DO NOTHING so existing records are preserved.
-- ============================================================================

-- 1. Seed Workspace Configuration
INSERT INTO public.workspaces (
  id, name, programme_title, default_timezone, enforce_mfa,
  operator_console_isolated, operator_seat_limit, max_account_slots, allow_auto_join
)
VALUES (
  'ws-truvornex',
  'Truvornex Engineering Workspace',
  'Truvornex Core Platform & Edge Runtime',
  'UTC',
  true,
  true,
  0,
  8,
  false
)
ON CONFLICT (id) DO NOTHING;

-- 2. Register Workspace Owner (Slot 1 of 8)
-- Automatically binds to auth.users if zomerceofficial@gmail.com already exists in Supabase Auth.
INSERT INTO public.workspace_accounts (
  id, workspace_id, auth_user_id, idp_subject, auth_provider,
  display_name, email, title, role, state, mfa_enabled,
  timezone, presence, chat_notification_mode, notify_on_channel_all, desktop_alerts
)
VALUES (
  'usr-owner',
  'ws-truvornex',
  (SELECT id FROM auth.users WHERE lower(email) = 'zomerceofficial@gmail.com' LIMIT 1),
  COALESCE(
    (SELECT 'supabase|' || id::text FROM auth.users WHERE lower(email) = 'zomerceofficial@gmail.com' LIMIT 1),
    'firebase|pending-owner'
  ),
  CASE
    WHEN EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = 'zomerceofficial@gmail.com') THEN 'supabase'
    ELSE 'firebase'
  END,
  'Workspace Owner',
  'zomerceofficial@gmail.com',
  'Workspace Owner',
  'Workspace Owner',
  'active',
  true,
  'UTC',
  'active',
  'mentions_only',
  true,
  false
)
ON CONFLICT (email) DO NOTHING;

-- 3. Optional: Register Remaining Pre-Created Accounts (Up to 8 Total Slots)
-- Replace the placeholder emails below with the real emails you created in
-- Supabase Auth -> Users or Firebase Auth, then uncomment and run:
/*
INSERT INTO public.workspace_accounts (
  id, workspace_id, idp_subject, auth_provider, display_name, email, title, role, state
)
VALUES
  ('usr-slot2', 'ws-truvornex', 'supabase|pending-2', 'supabase', 'Engineer 2', 'member2@yourdomain.com', 'Staff Engineer', 'Workspace Administrator', 'invited'),
  ('usr-slot3', 'ws-truvornex', 'supabase|pending-3', 'supabase', 'Engineer 3', 'member3@yourdomain.com', 'Platform Engineer', 'Team Lead', 'invited'),
  ('usr-slot4', 'ws-truvornex', 'supabase|pending-4', 'supabase', 'Engineer 4', 'member4@yourdomain.com', 'Backend Engineer', 'Contributor', 'invited'),
  ('usr-slot5', 'ws-truvornex', 'supabase|pending-5', 'supabase', 'Engineer 5', 'member5@yourdomain.com', 'QA Lead', 'Reviewer / QA', 'invited'),
  ('usr-slot6', 'ws-truvornex', 'supabase|pending-6', 'supabase', 'Engineer 6', 'member6@yourdomain.com', 'Frontend Engineer', 'Contributor', 'invited'),
  ('usr-slot7', 'ws-truvornex', 'supabase|pending-7', 'supabase', 'Engineer 7', 'member7@yourdomain.com', 'Security Engineer', 'Reviewer / QA', 'invited'),
  ('usr-slot8', 'ws-truvornex', 'supabase|pending-8', 'supabase', 'Engineer 8', 'member8@yourdomain.com', 'Observer', 'Read-only Observer', 'invited')
ON CONFLICT (email) DO NOTHING;
*/

-- 4. Seed Default Chat Channels
INSERT INTO public.chat_channels (id, name, topic, project_id, is_private, created_by)
VALUES
  ('ch-general', 'general', 'Workspace announcements, release milestones, and cross-team coordination', NULL, false, 'usr-owner'),
  ('ch-ctrl', 'ctrl-plane-dev', 'Control plane architecture, outbox replay, and policy engine reviews', NULL, false, 'usr-owner'),
  ('ch-edge', 'edge-telemetry', 'Edge telemetry, blocker triage, and staging readiness', NULL, false, 'usr-owner'),
  ('ch-qa', 'qa-verification', 'Acceptance evidence enforcement and verification queue', NULL, false, 'usr-owner'),
  ('ch-secr', 'security-governance', 'Trust boundaries, keyfile rotation, and restricted security reviews', NULL, true, 'usr-owner')
ON CONFLICT (id) DO NOTHING;

-- 5. Optional: Store Master or Per-Account JSON Keyfile SHA-256 Hash Directly in Postgres
-- Replace 'REPLACE_WITH_YOUR_SECRET_STRING_FROM_KEY_JSON' with the "secret" field inside your .json keyfile:
/*
INSERT INTO public.account_keyfiles (id, account_id, is_workspace_master, keyfile_sha256, issued_by)
VALUES (
  'trv-key-master',
  NULL,
  true,
  encode(sha256(convert_to('REPLACE_WITH_YOUR_SECRET_STRING_FROM_KEY_JSON', 'UTF8')), 'hex'),
  'usr-owner'
)
ON CONFLICT (id) DO UPDATE
SET
  keyfile_sha256 = EXCLUDED.keyfile_sha256,
  rotated_at = now();
*/

-- 6. Verification Query (Shows occupied slots out of 8)
SELECT
  count(*) FILTER (WHERE state <> 'revoked') AS slots_used,
  8 AS max_slots,
  8 - count(*) FILTER (WHERE state <> 'revoked') AS slots_open
FROM public.workspace_accounts;
