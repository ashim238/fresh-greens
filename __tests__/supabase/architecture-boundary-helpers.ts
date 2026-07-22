const path = require('path');
const ts = require('typescript') as typeof import('typescript');

const approvedRepositoryModules = new Set([
  'auth-repository',
  'community-reports-repository',
  'legacy-session',
  'moderation-repository',
  'roles-repository',
]);

const forbiddenClientSymbols = new Set([
  'createConfiguredSupabaseClient',
  'getSupabaseClient',
  'isSupabaseConfigured',
  'readSupabaseEnvironment',
  'startSupabaseAutoRefresh',
  'validateSupabaseAccessToken',
]);

const supabaseEnvironmentNames = new Set([
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
]);

function normalizeFile(file: string): string {
  return file.replaceAll(path.sep, '/');
}

function resolveModule(file: string, specifier: string): string {
  if (!specifier.startsWith('.')) return specifier;
  return path.posix.normalize(path.posix.join(
    path.posix.dirname(normalizeFile(file)),
    specifier,
  )).replace(/\.[cm]?[jt]sx?$/, '');
}

function isSdkModule(specifier: string): boolean {
  return specifier === '@supabase/supabase-js'
    || specifier.startsWith('@supabase/supabase-js/');
}

function isConfiguredClientModule(file: string, specifier: string): boolean {
  return resolveModule(file, specifier) === 'lib/supabase/client';
}

function supabaseModuleName(file: string, specifier: string): string | null {
  const resolved = resolveModule(file, specifier);
  const match = resolved.match(/^lib\/supabase\/([^/]+)$/);
  return match?.[1] ?? null;
}

function moduleSpecifierText(node: import('typescript').Expression): string | null {
  return ts.isStringLiteralLike(node) ? node.text : null;
}

function stringContainsServiceUrl(node: import('typescript').Node): boolean {
  if (
    !ts.isStringLiteralLike(node)
    && !ts.isTemplateHead(node)
    && !ts.isTemplateMiddle(node)
    && !ts.isTemplateTail(node)
  ) {
    return false;
  }
  return /\/(?:auth|rest|storage|functions)\/v1\b/.test(node.text);
}

export function findSupabaseBoundaryViolations(
  file: string,
  source: string,
): string[] {
  const normalizedFile = normalizeFile(file);
  const insideSupabase = normalizedFile.startsWith('lib/supabase/');
  const clientFile = normalizedFile === 'lib/supabase/client.ts';
  const violations = new Set<string>();
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const clientImportAliases = new Set<string>();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const specifier = moduleSpecifierText(statement.moduleSpecifier);
    if (!specifier || !isConfiguredClientModule(file, specifier)) continue;
    const clause = statement.importClause;
    if (clause?.name) clientImportAliases.add(clause.name.text);
    const bindings = clause?.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) {
      clientImportAliases.add(bindings.name.text);
    } else if (bindings) {
      for (const element of bindings.elements) {
        clientImportAliases.add(element.name.text);
      }
    }
  }

  const inspectModule = (
    specifier: string,
    operation: 'import' | 'export',
  ) => {
    const sdkModule = isSdkModule(specifier);
    const clientModule = isConfiguredClientModule(file, specifier);

    if (insideSupabase) {
      if (operation === 'export' && (sdkModule || clientModule) && !clientFile) {
        violations.add('client-facade');
      }
      return;
    }

    if (sdkModule) violations.add('supabase-sdk');
    if (clientModule) violations.add('configured-client');

    const repositoryModule = supabaseModuleName(file, specifier);
    if (
      repositoryModule
      && repositoryModule !== 'client'
      && !approvedRepositoryModules.has(repositoryModule)
    ) {
      violations.add('unapproved-supabase-module');
    }
  };

  const visit = (node: import('typescript').Node): void => {
    if (ts.isImportDeclaration(node)) {
      const specifier = moduleSpecifierText(node.moduleSpecifier);
      if (specifier) inspectModule(specifier, 'import');
    } else if (ts.isExportDeclaration(node)) {
      const specifier = node.moduleSpecifier
        ? moduleSpecifierText(node.moduleSpecifier)
        : null;
      if (specifier) inspectModule(specifier, 'export');
      if (
        insideSupabase
        && !clientFile
        && !specifier
        && node.exportClause
        && ts.isNamedExports(node.exportClause)
        && node.exportClause.elements.some((element) =>
          clientImportAliases.has((element.propertyName ?? element.name).text)
        )
      ) {
        violations.add('client-facade');
      }
    } else if (ts.isCallExpression(node)) {
      const dynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const requireCall = ts.isIdentifier(node.expression)
        && node.expression.text === 'require';
      if ((dynamicImport || requireCall) && node.arguments[0]) {
        const specifier = moduleSpecifierText(node.arguments[0]);
        if (specifier) inspectModule(specifier, 'import');
      }
    }

    if (!insideSupabase && ts.isIdentifier(node)) {
      if (forbiddenClientSymbols.has(node.text)) {
        violations.add('forbidden-client-symbol');
      }
      if (supabaseEnvironmentNames.has(node.text)) {
        violations.add('environment');
      }
    }
    if (!insideSupabase && ts.isStringLiteralLike(node)) {
      if (forbiddenClientSymbols.has(node.text)) {
        violations.add('forbidden-client-symbol');
      }
      if (supabaseEnvironmentNames.has(node.text)) {
        violations.add('environment');
      }
    }
    if (!insideSupabase && stringContainsServiceUrl(node)) {
      violations.add('service-url');
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return [...violations];
}
