# Truvornex Supabase SQL Editor Setup

Run these three files in order inside your Supabase project's **SQL Editor**:

1. `01_schema.sql` — Creates all relational tables, constraints, and indexes (`workspaces`, `workspace_accounts`, `account_keyfiles`, `projects`, `work_packages`, `documents`, `chat_channels`, `chat_messages`, `notifications`, `audit_events`, and supporting tables).
2. `02_security_and_8_slot_guard.sql` — Installs:
   - The atomic `8`-account capacity trigger (`enforce_max_8_account_slots`)
   - Automatic `auth.users` binding for pre-authorized emails (`bind_supabase_auth_user`)
   - Server-side chat notification routing (`route_chat_notifications` honoring `mentions_only`, `all_messages`, and `muted`)
   - Row Level Security (RLS) policies across every table (keeping `account_keyfiles` isolated from client reads)
3. `03_seed_and_owner_setup.sql` — Seeds the workspace config (`max_account_slots = 8`), registers `zomerceofficial@gmail.com` as the `Workspace Owner`, creates default chat channels, and includes templates for slots `2..8` and optional master `.json` keyfile hash registration.

## Required Environment Variables

Set these in `.env` (local) or Vercel Project Settings -> Environment Variables:

```env
VITE_SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
TRUVORNEX_SESSION_SECRET="your-32-plus-character-random-secret"
```
