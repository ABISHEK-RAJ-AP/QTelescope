#!/usr/bin/env node
/**
 * Fail on new hardcoded hex colors in app UI trees (ponytail: tokens only).
 * Usage: node scripts/check-hardcoded-styles.mjs
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SCAN_DIRS = ['src/pages', 'src/components/observability', 'src/components/ds'];
const ALLOW_FILES = new Set(['design-tokens.css']);
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.(jsx|tsx|css)$/.test(e.name)) yield p;
  }
}

let hits = 0;
for (const base of SCAN_DIRS) {
  const abs = join(ROOT, base);
  for await (const file of walk(abs)) {
    const rel = relative(ROOT, file);
    if (ALLOW_FILES.has(rel.split('/').pop())) continue;
    const text = await readFile(file, 'utf8');
    const matches = text.match(HEX_RE);
    if (matches?.length) {
      const uniq = [...new Set(matches)];
      console.log(`${rel}: ${uniq.length} hex literal(s) e.g. ${uniq.slice(0, 3).join(', ')}`);
      hits += 1;
    }
  }
}

if (hits > 0) {
  console.error(`\ncheck:tokens failed — ${hits} file(s) with hardcoded hex. Use var(--ds-*) or design-tokens.css.`);
  process.exit(1);
}
console.log('check:tokens OK (no hex in scanned UI dirs)');
