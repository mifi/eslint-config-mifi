#!/usr/bin/env node
// Renames rules in eslint-disable/enable comments to their oxlint names in our config (see migrateSource.mjs)
// Usage: npx mifi-lint-migrate [files...] (defaults to all JS/TS files tracked by git)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import migrateSource from './migrateSource.mjs';

const files = process.argv.length > 2
  ? process.argv.slice(2)
  // -z: unquoted paths, separated by NUL. Skips tracked files that were deleted
  : execFileSync('git', ['ls-files', '-z', '*.js', '*.jsx', '*.mjs', '*.cjs', '*.ts', '*.tsx', '*.mts', '*.cts'], { encoding: 'utf8', maxBuffer: 1024 ** 3 }).split('\0').filter((file) => file !== '' && existsSync(file));
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const migrated = migrateSource(source);
  if (migrated === source) continue;
  writeFileSync(file, migrated);
  console.log(file);
}
