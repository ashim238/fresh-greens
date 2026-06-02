#!/usr/bin/env node
// Specimen drift check.
//
// The design specimen (fresh-greens-specimen/index.html) hand-mirrors
// the color tokens in theme/colors.ts. Hand-mirrors drift: a token added
// to the app silently goes missing from the specimen, and the README
// links portfolio visitors at the out-of-date page. This script is the
// enforcement — it compares the two and exits non-zero on any mismatch,
// so the drift surfaces at audit time instead of in front of a recruiter.
//
// Run: `npm run check:specimen` (also wired into the pre-merge audit,
// docs/workflow.md Step 10).
//
// The specimen is a SEPARATE repo (gitignored here, github.com/ashim238/
// fresh-greens-specimen) that "sometimes gets cloned" locally. If it
// isn't present, the check SKIPS with a note rather than failing — you
// can't drift-check a file you don't have.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const THEME = join(root, 'theme', 'colors.ts');
const SPECIMEN = join(root, 'fresh-greens-specimen', 'index.html');

/** All #RRGGBB hexes in a file, upper-cased + de-duped. */
function hexes(file) {
  const text = readFileSync(file, 'utf8');
  return new Set(
    (text.match(/#[0-9a-fA-F]{6}\b/g) ?? []).map((h) => h.toUpperCase()),
  );
}

if (!existsSync(SPECIMEN)) {
  console.log(
    'check:specimen — SKIP (fresh-greens-specimen/ not cloned locally; ' +
      'clone it from github.com/ashim238/fresh-greens-specimen to drift-check).',
  );
  process.exit(0);
}

const themeHexes = hexes(THEME);
const specimenHexes = hexes(SPECIMEN);

// Tokens in the app theme but missing from the specimen — the drift that
// matters (the specimen is stale). The reverse (hexes in the specimen but
// not the theme) is mostly the spec page's own chrome (#FAFAFA page bg,
// blend stops), so we don't fail on it — only warn.
const missingFromSpecimen = [...themeHexes].filter((h) => !specimenHexes.has(h)).sort();
const extraInSpecimen = [...specimenHexes].filter((h) => !themeHexes.has(h)).sort();

if (missingFromSpecimen.length === 0) {
  console.log(
    `check:specimen — OK (all ${themeHexes.size} theme hexes present in the specimen).`,
  );
  if (extraInSpecimen.length > 0) {
    console.log(
      `  note: ${extraInSpecimen.length} hex(es) in the specimen aren't in theme/colors.ts ` +
        `(expected — spec-page chrome + gradient blend stops): ${extraInSpecimen.join(', ')}`,
    );
  }
  process.exit(0);
}

console.error(
  `check:specimen — DRIFT: ${missingFromSpecimen.length} theme token(s) missing from ` +
    `fresh-greens-specimen/index.html:\n  ${missingFromSpecimen.join('\n  ')}\n` +
    `\nThe specimen is README-linked — update it (both the :root mirror and the visible ` +
    `swatch grid) so portfolio visitors don't land on a stale design system, then commit + ` +
    `push the sibling repo.`,
);
process.exit(1);
