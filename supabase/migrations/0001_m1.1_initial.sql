-- M1.1 — Community cloud + RLS + moderation
-- Spec: docs/specs/2026-06-28-supabase-m1.1-rls-moderation.md
--
-- This file is idempotent-friendly (uses IF NOT EXISTS where the API allows)
-- but is designed to run once on a fresh Supabase project. Apply order:
--   1. This file (schema + RLS + RPCs + triggers + views).
--   2. supabase/seed.sql (bootstrap your moderator row).
--   3. Schedule the cron job (last block of this file).

-- --------------------------------------------------------------------------
-- Required extensions
-- --------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;     -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS cube;         -- earth_distance dependency
CREATE EXTENSION IF NOT EXISTS earthdistance; -- earth_distance, ll_to_earth
-- pg_cron must be enabled via the Supabase dashboard (Database → Extensions)
-- before the cron.schedule() call at the bottom of this file runs.

-- --------------------------------------------------------------------------
-- community_reports — base table (created if not pre-existing)
-- --------------------------------------------------------------------------
-- The existing community-cloud.ts client expects these columns:
--   id, category_id, location, detail, sub_tag, place_name, google_place_id,
--   submitted_by, photo_uri, timestamp
-- This block creates them if they don't exist, then ADDs the M1.1 columns.

CREATE TABLE IF NOT EXISTS community_reports (
  id text PRIMARY KEY,
  category_id text NOT NULL,
  location jsonb NOT NULL,
  detail text,
  sub_tag text,
  place_name text,
  google_place_id text,
  submitted_by text,
  photo_uri text,
  timestamp bigint NOT NULL
);

-- M1.1 column additions
ALTER TABLE community_reports
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS device_uuid text,
  ADD COLUMN IF NOT EXISTS submitter_ip inet,
  ADD COLUMN IF NOT EXISTS is_verified_phone boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz,
  ADD COLUMN IF NOT EXISTS hidden_reason text,
  ADD COLUMN IF NOT EXISTS removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS place_type text;

-- device_uuid becomes NOT NULL once existing rows (if any) are backfilled.
-- For a fresh project there are no pre-existing rows; safe to enforce now.
ALTER TABLE community_reports ALTER COLUMN device_uuid SET NOT NULL;

CREATE INDEX IF NOT EXISTS community_reports_device_uuid_ts_idx
  ON community_reports (device_uuid, timestamp DESC);
CREATE INDEX IF NOT EXISTS community_reports_submitter_ip_ts_idx
  ON community_reports (submitter_ip, timestamp DESC);
CREATE INDEX IF NOT EXISTS community_reports_visible_idx
  ON community_reports (hidden_at, removed_at)
  WHERE hidden_at IS NULL AND removed_at IS NULL;
CREATE INDEX IF NOT EXISTS community_reports_category_ts_idx
  ON community_reports (category_id, timestamp DESC);

-- --------------------------------------------------------------------------
-- user_roles — moderator role registry
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('moderator')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES auth.users(id),
  PRIMARY KEY (user_id, role)
);

-- --------------------------------------------------------------------------
-- report_flags — user-side flagging
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS report_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id text NOT NULL REFERENCES community_reports(id),
  flagger_auth_user_id uuid REFERENCES auth.users(id) NOT NULL,
  flagger_device_uuid text NOT NULL,
  flagger_ip inet NOT NULL,
  reason text,
  reason_category text CHECK (reason_category IN
    ('spam', 'inaccurate', 'misleading', 'abusive', 'other')) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, flagger_device_uuid)
);

-- --------------------------------------------------------------------------
-- device_bans — Remove-action enforcement
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS device_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_uuid text NOT NULL,
  category_id text,
  banned_until timestamptz NOT NULL,
  reason text NOT NULL,
  banned_by uuid REFERENCES auth.users(id) NOT NULL,
  banned_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS device_bans_active_idx
  ON device_bans (device_uuid, banned_until)
  WHERE banned_until > now();

-- --------------------------------------------------------------------------
-- moderation_actions — audit log (immutable)
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) NOT NULL,
  target_report_id text NOT NULL,
  action text NOT NULL CHECK (action IN
    ('moderator-remove', 'moderator-restore', 'moderator-ban',
     'submitter-delete', 'correction')),
  notes text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moderation_actions_target_idx
  ON moderation_actions (target_report_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS moderation_actions_actor_idx
  ON moderation_actions (actor_user_id, occurred_at DESC);

-- --------------------------------------------------------------------------
-- moderator_devices — push notification token registry
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS moderator_devices (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token text NOT NULL,
  registered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, expo_push_token)
);

-- --------------------------------------------------------------------------
-- Views
-- --------------------------------------------------------------------------

-- Public wire view: strips server-only cols, enforces per-category anonymity,
-- derives trust_tier. Public clients consume THIS, not the base table.
CREATE OR REPLACE VIEW community_reports_public AS
SELECT
  id, category_id, location, detail, sub_tag, place_name,
  place_type, google_place_id, photo_uri, timestamp,
  CASE
    WHEN category_id IN ('lighting','hazard','incident','felt-unsafe')
    THEN NULL
    ELSE submitted_by
  END AS submitted_by,
  CASE
    WHEN is_verified_phone THEN 'verified'
    WHEN auth_user_id IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM auth.identities
           WHERE user_id = community_reports.auth_user_id
             AND provider = 'apple'
         ) THEN 'community'
    ELSE 'contributor'
  END AS trust_tier
FROM community_reports
WHERE hidden_at IS NULL AND removed_at IS NULL;

GRANT SELECT ON community_reports_public TO anon, authenticated;

-- Moderator-only full-fidelity view (every column).
-- Access gated by RLS on the underlying base table.
CREATE OR REPLACE VIEW community_reports_moderation AS
SELECT * FROM community_reports;

-- Aggregate transparency view (Q16): public-readable, no actor/target IDs.
CREATE OR REPLACE VIEW moderation_actions_public AS
SELECT
  action,
  date_trunc('day', occurred_at) AS day,
  count(*) AS action_count
FROM moderation_actions
GROUP BY action, date_trunc('day', occurred_at);

GRANT SELECT ON moderation_actions_public TO anon, authenticated;

-- --------------------------------------------------------------------------
-- RLS — community_reports
-- --------------------------------------------------------------------------

ALTER TABLE community_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON community_reports FROM anon, authenticated;
REVOKE DELETE ON community_reports FROM anon, authenticated;

-- SELECT (moderator only on the base; everyone reads via the view)
CREATE POLICY community_reports_moderator_select ON community_reports
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'moderator'
  ));

-- INSERT policy — boolean gate (the trigger handles procedural checks)
CREATE POLICY community_reports_insert ON community_reports
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth_user_id = auth.uid()
    AND CASE
      WHEN category_id IN ('lighting','hazard','incident','felt-unsafe')
        THEN EXISTS (
          SELECT 1 FROM auth.identities
          WHERE user_id = auth.uid() AND provider = 'apple'
        )
      ELSE true
    END
  );

-- UPDATE policy — submitter-only on their own row; trigger restricts cols
CREATE POLICY community_reports_attribution_update ON community_reports
  FOR UPDATE TO authenticated
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

-- INSERT trigger — server-side enforcement of all rate limits, bans, IP
CREATE OR REPLACE FUNCTION enforce_report_insert() RETURNS trigger AS $$
DECLARE
  recent_count int;
  cluster_count int;
BEGIN
  NEW.submitter_ip := inet_client_addr();
  IF NEW.device_uuid IS NULL THEN
    RAISE EXCEPTION 'device_uuid required' USING ERRCODE = '23502';
  END IF;

  IF EXISTS (
    SELECT 1 FROM device_bans
    WHERE device_uuid = NEW.device_uuid
      AND banned_until > now()
      AND (category_id IS NULL OR category_id = NEW.category_id)
  ) THEN
    RAISE EXCEPTION 'device banned for this category' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO recent_count
    FROM community_reports
   WHERE device_uuid = NEW.device_uuid
     AND timestamp > extract(epoch FROM now() - interval '24 hours') * 1000;

  IF NEW.category_id IN ('lighting','hazard','incident','felt-unsafe') THEN
    IF recent_count >= 5 AND NOT NEW.is_verified_phone THEN
      RAISE EXCEPTION 'otp escalation required' USING ERRCODE = 'P0002';
    END IF;
    IF recent_count >= 3 THEN
      RAISE EXCEPTION 'rate limit exceeded' USING ERRCODE = 'P0003';
    END IF;
  ELSE
    IF recent_count >= 8 THEN
      RAISE EXCEPTION 'rate limit exceeded' USING ERRCODE = 'P0003';
    END IF;
  END IF;

  IF NEW.category_id IN ('lighting','hazard','incident','felt-unsafe') THEN
    SELECT count(*) INTO cluster_count
      FROM community_reports
     WHERE device_uuid = NEW.device_uuid
       AND timestamp > extract(epoch FROM now() - interval '24 hours') * 1000
       AND earth_distance(
             ll_to_earth(
               (location->>'latitude')::float,
               (location->>'longitude')::float),
             ll_to_earth(
               (NEW.location->>'latitude')::float,
               (NEW.location->>'longitude')::float)
           ) <= 50;
    IF cluster_count >= 1 THEN
      RAISE EXCEPTION 'cluster limit exceeded' USING ERRCODE = 'P0004';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS community_reports_insert_trg ON community_reports;
CREATE TRIGGER community_reports_insert_trg
  BEFORE INSERT ON community_reports
  FOR EACH ROW EXECUTE FUNCTION enforce_report_insert();

-- UPDATE trigger — column allow-list enforcement
CREATE OR REPLACE FUNCTION enforce_attribution_only_update() RETURNS trigger AS $$
BEGIN
  IF NEW.category_id IS DISTINCT FROM OLD.category_id
    OR NEW.location IS DISTINCT FROM OLD.location
    OR NEW.detail IS DISTINCT FROM OLD.detail
    OR NEW.sub_tag IS DISTINCT FROM OLD.sub_tag
    OR NEW.place_name IS DISTINCT FROM OLD.place_name
    OR NEW.google_place_id IS DISTINCT FROM OLD.google_place_id
    OR NEW.place_type IS DISTINCT FROM OLD.place_type
    OR NEW.timestamp IS DISTINCT FROM OLD.timestamp
    OR NEW.device_uuid IS DISTINCT FROM OLD.device_uuid
    OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id
    OR NEW.is_verified_phone IS DISTINCT FROM OLD.is_verified_phone
  THEN
    RAISE EXCEPTION 'only attribution columns are user-editable'
      USING ERRCODE = 'P0005';
  END IF;

  IF NEW.photo_uri IS DISTINCT FROM OLD.photo_uri
     AND OLD.photo_uri IS NOT NULL AND NEW.photo_uri IS NOT NULL THEN
    RAISE EXCEPTION 'photo can be added or removed, not swapped'
      USING ERRCODE = 'P0006';
  END IF;

  IF NEW.hidden_at IS DISTINCT FROM OLD.hidden_at
    OR NEW.removed_at IS DISTINCT FROM OLD.removed_at
    OR NEW.hidden_reason IS DISTINCT FROM OLD.hidden_reason
  THEN
    RAISE EXCEPTION 'state columns are moderator-only'
      USING ERRCODE = 'P0007';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS community_reports_update_trg ON community_reports;
CREATE TRIGGER community_reports_update_trg
  BEFORE UPDATE ON community_reports
  FOR EACH ROW EXECUTE FUNCTION enforce_attribution_only_update();

-- --------------------------------------------------------------------------
-- Soft-delete RPCs
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION submitter_delete_report(p_report_id text)
  RETURNS void AS $$
BEGIN
  UPDATE community_reports
     SET removed_at = now(),
         hidden_reason = 'submitter-deleted'
   WHERE id = p_report_id
     AND auth_user_id = auth.uid()
     AND removed_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not your report, or already removed';
  END IF;
  INSERT INTO moderation_actions (actor_user_id, target_report_id, action)
    VALUES (auth.uid(), p_report_id, 'submitter-delete');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION moderator_remove_report(p_report_id text, p_reason text)
  RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'moderator'
  ) THEN
    RAISE EXCEPTION 'not a moderator';
  END IF;
  UPDATE community_reports
     SET removed_at = now(),
         hidden_reason = 'moderator-action'
   WHERE id = p_report_id AND removed_at IS NULL;
  INSERT INTO moderation_actions (actor_user_id, target_report_id, action, notes)
    VALUES (auth.uid(), p_report_id, 'moderator-remove', p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION moderator_restore_report(p_report_id text, p_reason text)
  RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'moderator'
  ) THEN
    RAISE EXCEPTION 'not a moderator';
  END IF;
  UPDATE community_reports
     SET removed_at = NULL,
         hidden_at = NULL,
         hidden_reason = NULL
   WHERE id = p_report_id;
  INSERT INTO moderation_actions (actor_user_id, target_report_id, action, notes)
    VALUES (auth.uid(), p_report_id, 'moderator-restore', p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------------------------
-- RLS — report_flags
-- --------------------------------------------------------------------------

ALTER TABLE report_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY report_flags_moderator_select ON report_flags
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'moderator'
  ));

CREATE POLICY report_flags_insert ON report_flags
  FOR INSERT TO authenticated
  WITH CHECK (flagger_auth_user_id = auth.uid());

-- UPDATE / DELETE blocked: no policies = default-deny under RLS.

-- Auto-hide-on-threshold trigger (Q7 anti-brigade rule)
CREATE OR REPLACE FUNCTION check_flag_auto_hide() RETURNS trigger AS $$
DECLARE
  flag_count int;
  distinct_ip_count int;
  distinct_device_count int;
BEGIN
  -- IP stamp for the flag (server-side, can't be client-set)
  NEW.flagger_ip := inet_client_addr();

  SELECT count(*),
         count(DISTINCT flagger_ip),
         count(DISTINCT flagger_device_uuid)
    INTO flag_count, distinct_ip_count, distinct_device_count
    FROM report_flags
   WHERE report_id = NEW.report_id
     AND created_at > now() - interval '24 hours';

  -- Auto-hide threshold: 2+ flags AND 2+ distinct IPs AND 2+ distinct devices.
  -- Same-IP or same-device collapses the count → defeats flag brigading from
  -- a single attacker. Includes the row being inserted in the count (counted
  -- AFTER insert via AFTER trigger).
  IF flag_count >= 2
     AND distinct_ip_count >= 2
     AND distinct_device_count >= 2 THEN
    UPDATE community_reports
       SET hidden_at = now(),
           hidden_reason = 'flag-threshold'
     WHERE id = NEW.report_id AND hidden_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS report_flags_after_insert ON report_flags;
CREATE TRIGGER report_flags_after_insert
  AFTER INSERT ON report_flags
  FOR EACH ROW EXECUTE FUNCTION check_flag_auto_hide();

-- BEFORE INSERT trigger for the IP stamp (must run before the AFTER one)
CREATE OR REPLACE FUNCTION stamp_flag_ip() RETURNS trigger AS $$
BEGIN
  NEW.flagger_ip := inet_client_addr();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS report_flags_before_insert ON report_flags;
CREATE TRIGGER report_flags_before_insert
  BEFORE INSERT ON report_flags
  FOR EACH ROW EXECUTE FUNCTION stamp_flag_ip();

-- --------------------------------------------------------------------------
-- RLS — user_roles
-- --------------------------------------------------------------------------

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_roles_moderator_select ON user_roles
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'moderator'
  ));

CREATE POLICY user_roles_moderator_write ON user_roles
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'moderator'
  ));

-- --------------------------------------------------------------------------
-- RLS — device_bans
-- --------------------------------------------------------------------------

ALTER TABLE device_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY device_bans_moderator_all ON device_bans
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'moderator'
  ));

-- --------------------------------------------------------------------------
-- RLS — moderation_actions
-- --------------------------------------------------------------------------

ALTER TABLE moderation_actions ENABLE ROW LEVEL SECURITY;

-- SELECT moderator-only (audit log readable by mods)
CREATE POLICY moderation_actions_moderator_select ON moderation_actions
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'moderator'
  ));

-- INSERT only via SECURITY DEFINER RPCs (no policy = no direct INSERT)
-- UPDATE / DELETE never (no policy = default-deny). The audit log is
-- Postgres-enforced-immutable.

-- The aggregate moderation_actions_public view was GRANTed SELECT above
-- and bypasses RLS structurally — PII is filtered in the view definition.

-- --------------------------------------------------------------------------
-- RLS — moderator_devices
-- --------------------------------------------------------------------------

ALTER TABLE moderator_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY moderator_devices_self_register ON moderator_devices
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'moderator'
    )
  );

CREATE POLICY moderator_devices_self_read ON moderator_devices
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- --------------------------------------------------------------------------
-- IP retention cron job (90-day nullification)
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION purge_old_ips() RETURNS void AS $$
BEGIN
  UPDATE community_reports
     SET submitter_ip = NULL
   WHERE submitter_ip IS NOT NULL
     AND timestamp < extract(epoch FROM now() - interval '90 days') * 1000;

  UPDATE report_flags
     SET flagger_ip = NULL
   WHERE flagger_ip IS NOT NULL
     AND created_at < now() - interval '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule nightly at 3 AM UTC. Requires pg_cron extension enabled via the
-- Supabase dashboard. Run this AFTER enabling the extension:
--   SELECT cron.schedule('purge-old-ips', '0 3 * * *', 'SELECT purge_old_ips()');
