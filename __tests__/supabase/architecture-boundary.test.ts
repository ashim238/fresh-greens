const fs = require('fs');
const path = require('path');

const productionRoots = ['app', 'hooks', 'lib'];
const supabaseRoot = `${path.join('lib', 'supabase')}${path.sep}`;

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
    if (file.startsWith(supabaseRoot)) return [];

    const source = fs.readFileSync(file, 'utf8');
    const directSdk = /(?:from\s*|require\(\s*)['"]@supabase\/supabase-js['"]/.test(
      source,
    );
    const directClient = /(?:from\s*|require\(\s*)['"][^'"]*supabase\/client['"]/.test(
      source,
    );
    const directUrl = /\/(?:auth|rest|storage|functions)\/v1\b/.test(source);
    const directEnvironment = /EXPO_PUBLIC_SUPABASE_(?:URL|PUBLISHABLE_KEY|ANON_KEY)/.test(
      source,
    );

    return directSdk || directClient || directUrl || directEnvironment
      ? [file]
      : [];
  });

  expect(violations).toEqual([]);
});
