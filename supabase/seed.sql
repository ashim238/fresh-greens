-- M1.1 — Bootstrap seed
-- Spec: docs/specs/2026-06-28-supabase-m1.1-rls-moderation.md
--
-- This file is run ONCE per Supabase project, after the initial migration.
--
-- Steps:
--   1. Sign in to the Fresh Greens app on your phone with Apple Sign-in.
--      That creates your `auth.users` row.
--   2. In Supabase dashboard → Authentication → Users, find your row.
--      Copy the UUID from the `id` column.
--   3. Replace the PLACEHOLDER below with that UUID.
--   4. Run this file via the Supabase SQL editor.
--   5. Verify: `SELECT * FROM user_roles;` should return one row with
--      role = 'moderator' and your user_id.
--
-- After this seed runs, you have moderator privileges and can use the
-- in-app /moderation route.

INSERT INTO user_roles (user_id, role, granted_by)
VALUES (
  '00000000-0000-0000-0000-000000000000',  -- PLACEHOLDER: replace with your auth.users.id
  'moderator',
  NULL  -- bootstrap row; subsequent moderators get a non-null granted_by
);
