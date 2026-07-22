const fs = jest.requireActual('fs') as {
  existsSync(path: string): boolean;
  readFileSync(path: string, encoding: string): string;
};
const path = jest.requireActual('path') as {
  join(...parts: string[]): string;
};

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/0002_supabase_sdk_contract_fix.sql',
);
const seedPath = path.join(process.cwd(), 'supabase/seed.sql');

function readMigration(): string {
  return fs.existsSync(migrationPath)
    ? fs.readFileSync(migrationPath, 'utf8').toLowerCase()
    : '';
}

function functionDefinition(sql: string, name: string): string {
  const start = sql.indexOf(`create or replace function ${name}`);
  if (start < 0) return '';
  const next = sql.indexOf('create or replace function ', start + 1);
  return sql.slice(start, next < 0 ? sql.length : next);
}

function normalizedSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

function policyDefinition(sql: string, name: string): string {
  const start = sql.indexOf(`create policy ${name}`);
  if (start < 0) return '';
  const end = sql.indexOf(';', start);
  return sql.slice(start, end < 0 ? sql.length : end);
}

describe('corrective Supabase migration security contract', () => {
  test('adds a second versioned migration instead of rewriting the initial schema', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  test('submits reports only through a server-owned RPC', () => {
    const migration = readMigration();
    const submit = functionDefinition(migration, 'public.submit_report');

    expect(submit).toContain('security definer');
    expect(submit).toContain('set search_path = pg_catalog, public, auth');
    expect(submit).toContain('auth.uid()');
    expect(submit).toContain("current_setting('request.headers', true)");
    expect(submit).toContain('phone_confirmed_at');
    expect(submit).toContain('clock_timestamp()');
    expect(submit).not.toMatch(
      /p_(?:auth_user_id|device_uuid|submitter_ip|is_verified_phone|timestamp|submitted_by|photo_uri)/,
    );
    expect(normalizedSql(migration)).toContain(
      'revoke all on table public.community_reports from public, anon, authenticated',
    );
    expect(migration).toContain(
      'grant execute on function public.submit_report',
    );
  });

  test('uses non-recursive role checks and secure moderator read RPCs', () => {
    const migration = readMigration();
    const roleHelper = functionDefinition(migration, 'private.is_moderator');
    const moderatorRead = functionDefinition(
      migration,
      'public.moderator_list_reports',
    );
    const moderatorFlagRead = functionDefinition(
      migration,
      'public.moderator_list_report_flags',
    );

    expect(roleHelper).toContain('security definer');
    expect(roleHelper).toContain('set search_path = pg_catalog, public, auth');
    expect(roleHelper).toContain('from public.user_roles');
    expect(migration).toContain('drop view if exists public.community_reports_moderation');
    expect(moderatorRead).toContain('private.is_moderator()');
    expect(moderatorRead).toContain('security invoker');
    expect(moderatorRead).not.toContain('security definer');
    expect(moderatorFlagRead).toContain('security invoker');
    expect(policyDefinition(migration, 'community_reports_moderator_select'))
      .toContain('private.is_moderator()');
    expect(policyDefinition(migration, 'report_flags_moderator_select'))
      .toContain('private.is_moderator()');
    expect(migration).toContain(
      'using (user_id = auth.uid())',
    );
    expect(policyDefinition(migration, 'user_roles_self_select')).not.toContain(
      'from public.user_roles',
    );
    expect(migration).toContain(
      'grant usage on schema private to authenticated',
    );
    expect(normalizedSql(migration)).toContain(
      'grant execute on function private.is_moderator() to authenticated',
    );
  });

  test('restricts every callable definer and audits report state transitions', () => {
    const migration = readMigration();

    for (const functionName of [
      'submitter_delete_report',
      'moderator_remove_report',
      'moderator_restore_report',
      'flag_report',
    ]) {
      const definition = functionDefinition(
        migration,
        `public.${functionName}`,
      );
      expect(definition).toContain('security definer');
      expect(definition).toContain('set search_path = pg_catalog, public, auth');
    }

    expect(migration).toContain("'auto-hide'");
    expect(migration).toContain('insert into public.moderation_actions');
    expect(migration).toContain('revoke execute on all functions in schema public');
    expect(migration).toContain('from public, anon, authenticated');
  });

  test('makes IP nullification executable and schedules it when pg_cron exists', () => {
    const migration = readMigration();
    const purge = functionDefinition(migration, 'public.purge_old_ips');

    expect(migration).toContain(
      'alter column flagger_ip drop not null',
    );
    expect(purge).toContain('set flagger_ip = null');
    expect(purge).toContain('set submitter_ip = null');
    expect(migration).toContain("extname = 'pg_cron'");
    expect(migration).toContain("cron.schedule");
    expect(migration).toContain("fresh-greens-purge-old-ips");
  });

  test('keeps public report rows non-identifying and filters cloud photo URLs', () => {
    const migration = readMigration();
    const publicViewStart = migration.search(
      /create (?:or replace )?view public\.community_reports_public/,
    );
    expect(publicViewStart).toBeGreaterThanOrEqual(0);
    const publicViewEnd = migration.indexOf(';', publicViewStart);
    const publicView = migration.slice(publicViewStart, publicViewEnd);

    expect(publicView).toContain('owned_by_current_user');
    expect(publicView).not.toContain('submitted_by');
    expect(publicView).toContain("photo_uri ~ '^https://'");
  });

  test('replaces the placeholder seed with an owner-only promotion call', () => {
    const seed = fs.readFileSync(seedPath, 'utf8').toLowerCase();

    expect(seed).not.toContain('00000000-0000-0000-0000-000000000000');
    expect(seed).toContain('private.bootstrap_first_moderator()');
    expect(seed).toContain('exactly one permanent user');
  });
});
