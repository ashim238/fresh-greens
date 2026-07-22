-- Supabase SDK contract correction
--
-- This migration intentionally follows 0001_m1.1_initial.sql. It removes
-- direct table mutation from mobile roles, replaces it with narrowly granted
-- RPCs, and makes every security-definer function use a fixed search path.

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

-- Retention must be able to null old network addresses. Automated moderation
-- has no human actor, so its audit row also needs a nullable actor.
ALTER TABLE public.report_flags
  ALTER COLUMN flagger_ip DROP NOT NULL;

ALTER TABLE public.moderation_actions
  ALTER COLUMN actor_user_id DROP NOT NULL;

ALTER TABLE public.moderation_actions
  DROP CONSTRAINT IF EXISTS moderation_actions_action_check;
ALTER TABLE public.moderation_actions
  ADD CONSTRAINT moderation_actions_action_check CHECK (
    action IN (
      'moderator-remove',
      'moderator-restore',
      'moderator-ban',
      'submitter-delete',
      'correction',
      'auto-hide'
    )
  );

-- Local file paths from pre-SDK rows are never valid cloud resources.
UPDATE public.community_reports
   SET photo_uri = NULL
 WHERE photo_uri IS NOT NULL
   AND photo_uri !~ '^https://';

ALTER TABLE public.community_reports
  DROP CONSTRAINT IF EXISTS community_reports_cloud_photo_uri_check;
ALTER TABLE public.community_reports
  ADD CONSTRAINT community_reports_cloud_photo_uri_check CHECK (
    photo_uri IS NULL OR photo_uri ~ '^https://'
  );

-- Remove the original direct-write trigger contract. Mobile callers no longer
-- receive INSERT or UPDATE privileges; the RPC below owns validation and all
-- server-derived fields.
DROP TRIGGER IF EXISTS community_reports_insert_trg
  ON public.community_reports;
DROP TRIGGER IF EXISTS community_reports_update_trg
  ON public.community_reports;
DROP FUNCTION IF EXISTS public.enforce_report_insert();
DROP FUNCTION IF EXISTS public.enforce_attribution_only_update();

DROP TRIGGER IF EXISTS report_flags_before_insert ON public.report_flags;
DROP FUNCTION IF EXISTS public.stamp_flag_ip();

-- Remove every recursive or direct-write policy from the first migration.
DROP POLICY IF EXISTS community_reports_moderator_select
  ON public.community_reports;
DROP POLICY IF EXISTS community_reports_insert
  ON public.community_reports;
DROP POLICY IF EXISTS community_reports_attribution_update
  ON public.community_reports;
DROP POLICY IF EXISTS report_flags_moderator_select
  ON public.report_flags;
DROP POLICY IF EXISTS report_flags_insert
  ON public.report_flags;
DROP POLICY IF EXISTS user_roles_moderator_select
  ON public.user_roles;
DROP POLICY IF EXISTS user_roles_moderator_write
  ON public.user_roles;
DROP POLICY IF EXISTS device_bans_moderator_all
  ON public.device_bans;
DROP POLICY IF EXISTS moderation_actions_moderator_select
  ON public.moderation_actions;
DROP POLICY IF EXISTS moderator_devices_self_register
  ON public.moderator_devices;
DROP POLICY IF EXISTS moderator_devices_self_read
  ON public.moderator_devices;

ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderator_devices ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.community_reports
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.report_flags
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.user_roles
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.device_bans
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.moderation_actions
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.moderator_devices
  FROM PUBLIC, anon, authenticated;

-- A user may inspect only their own role row. This policy never queries
-- user_roles from inside its own predicate, so it cannot recurse.
CREATE POLICY user_roles_self_select ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
GRANT SELECT (user_id, role) ON TABLE public.user_roles TO authenticated;

CREATE OR REPLACE FUNCTION private.is_moderator()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = pg_catalog, public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.user_roles
     WHERE user_id = auth.uid()
       AND role = 'moderator'
  );
$$;

CREATE POLICY community_reports_moderator_select
  ON public.community_reports
  FOR SELECT TO authenticated
  USING ((SELECT private.is_moderator()));

CREATE POLICY report_flags_moderator_select
  ON public.report_flags
  FOR SELECT TO authenticated
  USING ((SELECT private.is_moderator()));

GRANT SELECT (
  id,
  category_id,
  location,
  detail,
  place_name,
  place_type,
  submitted_by,
  timestamp,
  device_uuid,
  auth_user_id,
  submitter_ip,
  hidden_at,
  hidden_reason,
  removed_at,
  is_verified_phone
) ON TABLE public.community_reports TO authenticated;

GRANT SELECT (
  id,
  report_id,
  flagger_device_uuid,
  flagger_ip,
  reason,
  reason_category,
  created_at
) ON TABLE public.report_flags TO authenticated;

CREATE OR REPLACE FUNCTION private.bootstrap_first_moderator()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_user_count integer;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'moderator'
  ) THEN
    RAISE EXCEPTION 'a moderator already exists';
  END IF;

  SELECT count(*)
    INTO v_user_count
    FROM auth.users
   WHERE COALESCE(is_anonymous, false) = false;

  SELECT id
    INTO v_user_id
    FROM auth.users
   WHERE COALESCE(is_anonymous, false) = false
   ORDER BY created_at, id
   LIMIT 1;

  IF v_user_count <> 1 OR v_user_id IS NULL THEN
    RAISE EXCEPTION
      'bootstrap requires exactly one permanent user and no moderator';
  END IF;

  INSERT INTO public.user_roles (user_id, role, granted_by)
  VALUES (v_user_id, 'moderator', NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_report(
  p_id text,
  p_category_id text,
  p_location jsonb,
  p_detail text DEFAULT NULL,
  p_sub_tag text DEFAULT NULL,
  p_place_name text DEFAULT NULL,
  p_place_type text DEFAULT NULL,
  p_google_place_id text DEFAULT NULL
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_headers jsonb;
  v_device_uuid text;
  v_now timestamptz := clock_timestamp();
  v_timestamp bigint;
  v_is_verified_phone boolean;
  v_recent_count integer;
  v_cluster_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  BEGIN
    v_headers := NULLIF(current_setting('request.headers', true), '')::jsonb;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'request headers are invalid' USING ERRCODE = '22023';
  END;

  v_device_uuid := lower(NULLIF(btrim(COALESCE(
    v_headers ->> 'x-device-uuid',
    ''
  )), ''));
  IF v_device_uuid IS NULL OR v_device_uuid !~
    '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  THEN
    RAISE EXCEPTION 'a valid device identity is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_id IS NULL
     OR btrim(p_id) = ''
     OR length(p_id) > 128
     OR p_id ~ '[[:cntrl:]]'
  THEN
    RAISE EXCEPTION 'report id is invalid' USING ERRCODE = '22023';
  END IF;

  IF p_category_id NOT IN (
    'lighting',
    'hazard',
    'incident',
    'felt-unsafe',
    'felt-welcome',
    'black-owned'
  ) THEN
    RAISE EXCEPTION 'report category is invalid' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_location) <> 'object'
     OR jsonb_typeof(p_location -> 'latitude') <> 'number'
     OR jsonb_typeof(p_location -> 'longitude') <> 'number'
     OR (p_location ->> 'latitude')::double precision NOT BETWEEN -90 AND 90
     OR (p_location ->> 'longitude')::double precision NOT BETWEEN -180 AND 180
  THEN
    RAISE EXCEPTION 'report location is invalid' USING ERRCODE = '22023';
  END IF;

  IF length(COALESCE(p_detail, '')) > 2000
     OR length(COALESCE(p_sub_tag, '')) > 120
     OR length(COALESCE(p_place_name, '')) > 240
     OR length(COALESCE(p_place_type, '')) > 120
     OR length(COALESCE(p_google_place_id, '')) > 300
  THEN
    RAISE EXCEPTION 'report text is too long' USING ERRCODE = '22023';
  END IF;

  IF p_category_id IN ('lighting', 'hazard', 'incident', 'felt-unsafe')
     AND NOT EXISTS (
       SELECT 1
         FROM auth.identities
        WHERE user_id = v_user_id
          AND provider = 'apple'
     )
  THEN
    RAISE EXCEPTION 'permanent identity required' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(phone_confirmed_at IS NOT NULL, false)
    INTO v_is_verified_phone
    FROM auth.users
   WHERE id = v_user_id;
  v_is_verified_phone := COALESCE(v_is_verified_phone, false);
  v_timestamp := floor(extract(epoch FROM v_now) * 1000)::bigint;

  IF EXISTS (
    SELECT 1
      FROM public.device_bans
     WHERE device_uuid = v_device_uuid
       AND banned_until > v_now
       AND (category_id IS NULL OR category_id = p_category_id)
  ) THEN
    RAISE EXCEPTION 'device banned for this category' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*)
    INTO v_recent_count
    FROM public.community_reports
   WHERE device_uuid = v_device_uuid
     AND timestamp > floor(extract(epoch FROM v_now - interval '24 hours') * 1000);

  IF p_category_id IN ('lighting', 'hazard', 'incident', 'felt-unsafe') THEN
    IF v_recent_count >= 5 AND NOT v_is_verified_phone THEN
      RAISE EXCEPTION 'phone verification required' USING ERRCODE = 'P0002';
    END IF;
    IF v_recent_count >= 3 THEN
      RAISE EXCEPTION 'rate limit exceeded' USING ERRCODE = 'P0003';
    END IF;

    SELECT count(*)
      INTO v_cluster_count
      FROM public.community_reports
     WHERE device_uuid = v_device_uuid
       AND timestamp > floor(
         extract(epoch FROM v_now - interval '24 hours') * 1000
       )
       AND earth_distance(
         ll_to_earth(
           (location ->> 'latitude')::double precision,
           (location ->> 'longitude')::double precision
         ),
         ll_to_earth(
           (p_location ->> 'latitude')::double precision,
           (p_location ->> 'longitude')::double precision
         )
       ) <= 50;
    IF v_cluster_count >= 1 THEN
      RAISE EXCEPTION 'cluster limit exceeded' USING ERRCODE = 'P0004';
    END IF;
  ELSIF v_recent_count >= 8 THEN
    RAISE EXCEPTION 'rate limit exceeded' USING ERRCODE = 'P0003';
  END IF;

  INSERT INTO public.community_reports (
    id,
    category_id,
    location,
    detail,
    sub_tag,
    place_name,
    place_type,
    google_place_id,
    submitted_by,
    photo_uri,
    timestamp,
    auth_user_id,
    device_uuid,
    submitter_ip,
    is_verified_phone,
    hidden_at,
    hidden_reason,
    removed_at
  ) VALUES (
    p_id,
    p_category_id,
    p_location,
    NULLIF(btrim(p_detail), ''),
    NULLIF(btrim(p_sub_tag), ''),
    NULLIF(btrim(p_place_name), ''),
    NULLIF(btrim(p_place_type), ''),
    NULLIF(btrim(p_google_place_id), ''),
    NULL,
    NULL,
    v_timestamp,
    v_user_id,
    v_device_uuid,
    inet_client_addr(),
    v_is_verified_phone,
    NULL,
    NULL,
    NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submitter_delete_report(p_report_id text)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_report_id IS NULL OR btrim(p_report_id) = '' THEN
    RAISE EXCEPTION 'report deletion is invalid' USING ERRCODE = '22023';
  END IF;

  UPDATE public.community_reports
     SET removed_at = clock_timestamp(),
         hidden_reason = 'submitter-deleted'
   WHERE id = p_report_id
     AND auth_user_id = auth.uid()
     AND removed_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'report deletion was rejected' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.moderation_actions (
    actor_user_id,
    target_report_id,
    action
  ) VALUES (
    auth.uid(),
    p_report_id,
    'submitter-delete'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.moderator_remove_report(
  p_report_id text,
  p_reason text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  IF NOT private.is_moderator() THEN
    RAISE EXCEPTION 'moderator role required' USING ERRCODE = '42501';
  END IF;
  IF p_report_id IS NULL
     OR btrim(p_report_id) = ''
     OR p_reason IS NULL
     OR btrim(p_reason) = ''
     OR length(p_reason) > 500
  THEN
    RAISE EXCEPTION 'moderation input is invalid' USING ERRCODE = '22023';
  END IF;

  UPDATE public.community_reports
     SET removed_at = clock_timestamp(),
         hidden_reason = 'moderator-action'
   WHERE id = p_report_id
     AND removed_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'report is missing or already removed'
      USING ERRCODE = 'P0009';
  END IF;

  INSERT INTO public.moderation_actions (
    actor_user_id,
    target_report_id,
    action,
    notes
  ) VALUES (
    auth.uid(),
    p_report_id,
    'moderator-remove',
    btrim(p_reason)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.moderator_restore_report(
  p_report_id text,
  p_reason text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  IF NOT private.is_moderator() THEN
    RAISE EXCEPTION 'moderator role required' USING ERRCODE = '42501';
  END IF;
  IF p_report_id IS NULL
     OR btrim(p_report_id) = ''
     OR p_reason IS NULL
     OR btrim(p_reason) = ''
     OR length(p_reason) > 500
  THEN
    RAISE EXCEPTION 'moderation input is invalid' USING ERRCODE = '22023';
  END IF;

  UPDATE public.community_reports
     SET removed_at = NULL,
         hidden_at = NULL,
         hidden_reason = NULL
   WHERE id = p_report_id
     AND (
       removed_at IS NOT NULL
       OR hidden_at IS NOT NULL
       OR hidden_reason IS NOT NULL
     );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'report is missing or already visible'
      USING ERRCODE = 'P0009';
  END IF;

  INSERT INTO public.moderation_actions (
    actor_user_id,
    target_report_id,
    action,
    notes
  ) VALUES (
    auth.uid(),
    p_report_id,
    'moderator-restore',
    btrim(p_reason)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.flag_report(
  p_report_id text,
  p_reason_category text,
  p_reason text DEFAULT NULL
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_headers jsonb;
  v_device_uuid text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_report_id IS NULL OR btrim(p_report_id) = '' THEN
    RAISE EXCEPTION 'report id is invalid' USING ERRCODE = '22023';
  END IF;
  IF p_reason_category NOT IN (
    'spam', 'inaccurate', 'misleading', 'abusive', 'other'
  ) OR length(COALESCE(p_reason, '')) > 1000 THEN
    RAISE EXCEPTION 'flag input is invalid' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_headers := NULLIF(current_setting('request.headers', true), '')::jsonb;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'request headers are invalid' USING ERRCODE = '22023';
  END;
  v_device_uuid := lower(NULLIF(btrim(COALESCE(
    v_headers ->> 'x-device-uuid',
    ''
  )), ''));
  IF v_device_uuid IS NULL OR v_device_uuid !~
    '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  THEN
    RAISE EXCEPTION 'a valid device identity is required'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.community_reports
     WHERE id = p_report_id
       AND hidden_at IS NULL
       AND removed_at IS NULL
  ) THEN
    RAISE EXCEPTION 'report is unavailable' USING ERRCODE = 'P0009';
  END IF;

  INSERT INTO public.report_flags (
    report_id,
    flagger_auth_user_id,
    flagger_device_uuid,
    flagger_ip,
    reason,
    reason_category
  ) VALUES (
    p_report_id,
    auth.uid(),
    v_device_uuid,
    inet_client_addr(),
    NULLIF(btrim(p_reason), ''),
    p_reason_category
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_flag_auto_hide()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_flag_count integer;
  v_distinct_ip_count integer;
  v_distinct_device_count integer;
  v_hidden_report_id text;
BEGIN
  SELECT count(*),
         count(DISTINCT flagger_ip),
         count(DISTINCT flagger_device_uuid)
    INTO v_flag_count, v_distinct_ip_count, v_distinct_device_count
    FROM public.report_flags
   WHERE report_id = NEW.report_id
     AND created_at > clock_timestamp() - interval '24 hours';

  IF v_flag_count >= 2
     AND v_distinct_ip_count >= 2
     AND v_distinct_device_count >= 2
  THEN
    UPDATE public.community_reports
       SET hidden_at = clock_timestamp(),
           hidden_reason = 'flag-threshold'
     WHERE id = NEW.report_id
       AND hidden_at IS NULL
       AND removed_at IS NULL
    RETURNING id INTO v_hidden_report_id;

    IF v_hidden_report_id IS NOT NULL THEN
      INSERT INTO public.moderation_actions (
        actor_user_id,
        target_report_id,
        action,
        notes
      ) VALUES (
        NULL,
        v_hidden_report_id,
        'auto-hide',
        'flag-threshold'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS report_flags_after_insert ON public.report_flags;
CREATE TRIGGER report_flags_after_insert
  AFTER INSERT ON public.report_flags
  FOR EACH ROW EXECUTE FUNCTION public.check_flag_auto_hide();

DROP VIEW IF EXISTS public.community_reports_moderation;

CREATE OR REPLACE FUNCTION public.moderator_list_reports()
  RETURNS TABLE (
    id text,
    category_id text,
    location jsonb,
    detail text,
    place_name text,
    place_type text,
    submitted_by text,
    timestamp bigint,
    device_uuid text,
    auth_user_id uuid,
    submitter_ip inet,
    hidden_at timestamptz,
    hidden_reason text,
    removed_at timestamptz,
    is_verified_phone boolean
  )
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  IF NOT private.is_moderator() THEN
    RAISE EXCEPTION 'moderator role required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT report.id,
         report.category_id,
         report.location,
         report.detail,
         report.place_name,
         report.place_type,
         report.submitted_by,
         report.timestamp,
         report.device_uuid,
         report.auth_user_id,
         report.submitter_ip,
         report.hidden_at,
         report.hidden_reason,
         report.removed_at,
         report.is_verified_phone
    FROM public.community_reports AS report
   ORDER BY report.hidden_at DESC NULLS LAST,
            report.timestamp DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.moderator_list_report_flags(
  p_report_id text
)
  RETURNS TABLE (
    id uuid,
    report_id text,
    flagger_device_uuid text,
    flagger_ip inet,
    reason text,
    reason_category text,
    created_at timestamptz
  )
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  IF NOT private.is_moderator() THEN
    RAISE EXCEPTION 'moderator role required' USING ERRCODE = '42501';
  END IF;
  IF p_report_id IS NULL OR btrim(p_report_id) = '' THEN
    RAISE EXCEPTION 'report id is invalid' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT flag.id,
         flag.report_id,
         flag.flagger_device_uuid,
         flag.flagger_ip,
         flag.reason,
         flag.reason_category,
         flag.created_at
    FROM public.report_flags AS flag
   WHERE flag.report_id = p_report_id
   ORDER BY flag.created_at DESC;
END;
$$;

-- The public view contains no canonical user identifier. Ownership is computed
-- against the caller and remains false for intentionally anonymous categories.
DROP VIEW IF EXISTS public.community_reports_public;
CREATE VIEW public.community_reports_public
WITH (security_barrier = true)
AS
SELECT report.id,
       report.category_id,
       report.location,
       report.detail,
       report.sub_tag,
       report.place_name,
       report.place_type,
       report.google_place_id,
       CASE
         WHEN report.photo_uri ~ '^https://' THEN report.photo_uri
         ELSE NULL
       END AS photo_uri,
       report.timestamp,
       CASE
         WHEN report.category_id IN (
           'lighting', 'hazard', 'incident', 'felt-unsafe'
         ) THEN false
         ELSE COALESCE(report.auth_user_id = auth.uid(), false)
       END AS owned_by_current_user,
       CASE
         WHEN report.is_verified_phone THEN 'verified'
         WHEN EXISTS (
           SELECT 1
             FROM auth.identities AS identity
            WHERE identity.user_id = report.auth_user_id
              AND identity.provider = 'apple'
         ) THEN 'community'
         ELSE 'contributor'
       END AS trust_tier
  FROM public.community_reports AS report
 WHERE report.hidden_at IS NULL
   AND report.removed_at IS NULL;

REVOKE ALL ON TABLE public.community_reports_public
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.community_reports_public TO anon, authenticated;

CREATE OR REPLACE VIEW public.moderation_actions_public
WITH (security_barrier = true)
AS
SELECT action,
       date_trunc('day', occurred_at) AS day,
       count(*) AS action_count
  FROM public.moderation_actions
 GROUP BY action, date_trunc('day', occurred_at);

REVOKE ALL ON TABLE public.moderation_actions_public
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.moderation_actions_public TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.purge_old_ips()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  UPDATE public.community_reports
     SET submitter_ip = NULL
   WHERE submitter_ip IS NOT NULL
     AND timestamp < floor(
       extract(epoch FROM clock_timestamp() - interval '90 days') * 1000
     );

  UPDATE public.report_flags
     SET flagger_ip = NULL
   WHERE flagger_ip IS NOT NULL
     AND created_at < clock_timestamp() - interval '90 days';
END;
$$;

-- PostgreSQL grants function execution to PUBLIC by default. Reset the entire
-- exposed schema, then grant only the mobile operations that have an explicit
-- caller check. Trigger and retention functions remain owner-only.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.submit_report(
  text, text, jsonb, text, text, text, text, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submitter_delete_report(text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.flag_report(text, text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderator_remove_report(text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderator_restore_report(text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderator_list_reports()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderator_list_report_flags(text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_moderator()
  TO authenticated;

-- Install the nightly retention job when pg_cron is already enabled. If the
-- extension is unavailable, the migration raises a visible warning and the
-- release runbook keeps retention acceptance blocked until the operator enables
-- pg_cron and re-runs this exact scheduling statement.
DO $retention$
DECLARE
  v_job_id bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_extension WHERE extname = 'pg_cron'
  ) THEN
    EXECUTE
      'SELECT jobid FROM cron.job WHERE jobname = $1 LIMIT 1'
      INTO v_job_id
      USING 'fresh-greens-purge-old-ips';
    IF v_job_id IS NOT NULL THEN
      EXECUTE format('SELECT cron.unschedule(%s)', v_job_id);
    END IF;
    EXECUTE $schedule$
      SELECT cron.schedule(
        'fresh-greens-purge-old-ips',
        '0 3 * * *',
        'SELECT public.purge_old_ips()'
      )
    $schedule$;
  ELSE
    RAISE WARNING
      'pg_cron is not enabled; fresh-greens-purge-old-ips is not scheduled';
  END IF;
END;
$retention$;

COMMIT;
