const { readFileSync } = jest.requireActual('fs') as {
  readFileSync(path: string, encoding: string): string;
};

const hookSource = readFileSync('hooks/useModeratorRole.ts', 'utf8');
const screenSource = readFileSync('app/moderation.tsx', 'utf8');

describe('moderation consumer source contracts', () => {
  test('the moderator hook fails closed through auth and roles repositories', () => {
    expect(hookSource).toContain("from '../lib/supabase/auth-repository'");
    expect(hookSource).toContain("from '../lib/supabase/roles-repository'");
    expect(hookSource).toContain('useState(false)');
    expect(hookSource).toContain('backendAuthRepository.getUserId()');
    expect(hookSource).toContain('rolesRepository.hasModeratorRole(userId)');
    expect(hookSource).not.toMatch(
      /getAuthHeaders|getAuthUserId|isCommunityCloudConfigured|EXPO_PUBLIC_SUPABASE_URL|\bfetch\s*\(/,
    );
  });

  test('the moderation screen has no direct transport or client access', () => {
    expect(screenSource).toContain(
      "from '../lib/supabase/moderation-repository'",
    );
    expect(screenSource).not.toMatch(
      /getAuthHeaders|getSupabaseClient|EXPO_PUBLIC_SUPABASE_URL|\/rest\/v1|\bfetch\s*\(/,
    );
  });

  test('the screen delegates every moderation operation to the repository', () => {
    expect(screenSource).toContain('moderationRepository.fetchModerationQueue()');
    expect(screenSource).toContain('moderationRepository.fetchReportFlags(reportId)');
    expect(screenSource).toContain('loadFlags(report.id)');
    expect(screenSource).toContain('moderationRepository.restoreReport(');
    expect(screenSource).toContain('moderationRepository.removeReport(');
    expect(screenSource).toContain('moderationRepository.runBulkModeration(');
  });

  test('single and bulk action semantics and selection retention stay intact', () => {
    expect(screenSource).toContain("'Restored via moderation queue'");
    expect(screenSource).toContain("'Removed via moderation queue'");
    expect(screenSource).toContain(
      'selectedIds.has(r.id) && (r.hidden_at !== null || r.removed_at !== null)',
    );
    expect(screenSource).toContain(
      'selectedIds.has(r.id) && r.removed_at === null',
    );
    expect(screenSource).toContain('setSelectedIds(new Set(failedIds))');
    expect(screenSource).toContain('exitBulkMode()');
  });

  test('loading, error, haptic, confirmation, and flag UI contracts remain present', () => {
    for (const copy of [
      'No reports to review',
      'Could not load queue — check connection.',
      'Restore failed — try again.',
      'Restore failed — check connection.',
      'Remove failed — try again.',
      'Remove failed — check connection.',
      'They remain selected.',
      'Possible coordinated flagging detected',
      'No flags on this report.',
      'Hold to confirm removal',
    ]) {
      expect(screenSource).toContain(copy);
    }
    expect(screenSource.match(/NotificationFeedbackType\.Success/g)).toHaveLength(4);
    expect(
      screenSource.match(/NotificationFeedbackType\.Error/g)?.length ?? 0,
    ).toBeGreaterThanOrEqual(4);
    expect(screenSource.match(/thresholdMs: 800/g)).toHaveLength(2);
    expect(screenSource).toContain('flags.map((f) => (');
    expect(screenSource).not.toContain('Could not load queue — try again.');
    expect(screenSource).not.toContain('Could not load flags');
  });

  test('queue and flag failures preserve their base presentation semantics', () => {
    const queueLoader = screenSource.slice(
      screenSource.indexOf('const fetchQueue'),
      screenSource.indexOf('useEffect', screenSource.indexOf('const fetchQueue')),
    );
    const flagsLoader = screenSource.slice(
      screenSource.indexOf('async function fetchFlags()'),
      screenSource.indexOf('const { holdProgress', screenSource.indexOf('async function fetchFlags()')),
    );

    expect(queueLoader).toContain('setFetchError(true)');
    expect(queueLoader).not.toContain("error.code === 'rejected'");
    expect(
      screenSource.match(/Could not load queue — check connection\./g),
    ).toHaveLength(1);

    expect(flagsLoader).toContain('catch (error)');
    expect(flagsLoader).toContain('setFlags([])');
    expect(flagsLoader).not.toContain('flagsError');
    expect(flagsLoader).toContain('error instanceof ModerationRepositoryError');
    expect(flagsLoader).toContain("error.code !== 'rejected'");
    expect(screenSource).toContain('No flags on this report.');
  });
});
