const fs = require('fs');
const path = require('path');

import { findSupabaseBoundaryViolations } from './architecture-boundary-helpers';

// tsconfig.app excludes proxy, node_modules, and coverage. Tests are not
// production code; types is included because its declarations ship to tsc.
const productionRoots = [
  'app',
  'components',
  'hooks',
  'lib',
  'theme',
  'types',
];

function collectTypeScriptFiles(roots: readonly string[]): string[] {
  const visit = (entry: string): string[] => {
    const stat = fs.statSync(entry);
    if (stat.isDirectory()) {
      return fs.readdirSync(entry).flatMap((name: string) =>
        visit(path.join(entry, name))
      );
    }
    return /\.tsx?$/.test(entry) ? [entry] : [];
  };

  return roots.flatMap(visit);
}

test('only lib/supabase accesses the SDK client or Supabase connection details', () => {
  const violations = collectTypeScriptFiles(productionRoots).flatMap((file) => {
    const source = fs.readFileSync(file, 'utf8');
    return findSupabaseBoundaryViolations(file, source).length > 0
      ? [file]
      : [];
  });

  expect(violations).toEqual([]);
});

test('scans every production TypeScript root and catches component violations', () => {
  expect(productionRoots).toEqual([
    'app',
    'components',
    'hooks',
    'lib',
    'theme',
    'types',
  ]);
  expect(findSupabaseBoundaryViolations(
    'components/bypass.tsx',
    "const client = import('../lib/supabase/client');",
  )).toContain('configured-client');
});

describe('Supabase boundary source classification', () => {
  test.each([
    {
      name: 'dynamic SDK import',
      file: 'app/bypass.ts',
      source: "const sdk = import('@supabase/supabase-js');",
      violation: 'supabase-sdk',
    },
    {
      name: 'dynamic configured-client import',
      file: 'hooks/bypass.ts',
      source: "const client = import('../lib/supabase/client');",
      violation: 'configured-client',
    },
    {
      name: 'unapproved Supabase facade import',
      file: 'lib/api/bypass.ts',
      source: "import { backend } from '../supabase/backend-facade';",
      violation: 'unapproved-supabase-module',
    },
    {
      name: 'forbidden client symbol imported through a facade',
      file: 'app/bypass.ts',
      source: "import { getSupabaseClient as backend } from '../lib/backend';",
      violation: 'forbidden-client-symbol',
    },
    {
      name: 'forbidden client symbol accessed with bracket notation',
      file: 'app/bypass.ts',
      source: "const backend = facade['getSupabaseClient']();",
      violation: 'forbidden-client-symbol',
    },
    {
      name: 'Supabase environment accessed with bracket notation',
      file: 'lib/api/bypass.ts',
      source: "const url = process.env['EXPO_PUBLIC_SUPABASE_URL'];",
      violation: 'environment',
    },
    {
      name: 'configured client re-exported from inside the boundary',
      file: 'lib/supabase/backend-facade.ts',
      source: "export { getSupabaseClient as backend } from './client';",
      violation: 'client-facade',
    },
    {
      name: 'SDK re-exported from inside the boundary',
      file: 'lib/supabase/sdk-facade.ts',
      source: "export { createClient as backend } from '@supabase/supabase-js';",
      violation: 'client-facade',
    },
  ])('rejects $name', ({ file, source, violation }) => {
    expect(findSupabaseBoundaryViolations(file, source)).toContain(violation);
  });

  test.each([
    {
      name: 'product auth repository import',
      file: 'hooks/use-auth.ts',
      source:
        "import { backendAuthRepository } from '../lib/supabase/auth-repository';",
    },
    {
      name: 'SDK import within a repository',
      file: 'lib/supabase/auth-repository.ts',
      source: "import type { Session } from '@supabase/supabase-js';",
    },
    {
      name: 'client import within a repository',
      file: 'lib/supabase/auth-repository.ts',
      source: "import { getSupabaseClient } from './client';",
    },
    {
      name: 'forbidden text in a comment',
      file: 'lib/api/example.ts',
      source: '// EXPO_PUBLIC_SUPABASE_URL is intentionally unavailable here.',
    },
  ])('allows $name', ({ file, source }) => {
    expect(findSupabaseBoundaryViolations(file, source)).toEqual([]);
  });
});
