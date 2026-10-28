#!/usr/bin/env node
// Renames rules in eslint-disable/enable comments to their oxlint names in our config,
// e.g. `// eslint-disable-next-line import/no-extraneous-dependencies` -> `import-js/no-extraneous-dependencies`
// Usage: npx mifi-lint-migrate [files...] (defaults to all JS/TS files tracked by git)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('oxlintrc.json', import.meta.url), 'utf8'));

// The original ESLint plugins are loaded as JS plugins aliased `<plugin>-js` (`eslint-js` being ESLint's core rules)
const renames = Object.fromEntries(Object.keys(config.rules).flatMap((name) => {
  const match = name.match(/^(.+)-js\/(.+)$/);
  if (!match) return [];
  const [, plugin, rule] = match;
  return [[plugin === 'eslint' ? rule : `${plugin}/${rule}`, name]];
}));

const directive = /((?:\/\/|\/\*)\s*eslint-(?:disable|enable)(?:-next-line|-line)?\s+)(.*?)(?=\s--|\*\/|$)/gm;

export default function migrateSource(source) {
  return source.replaceAll(directive, (_, prefix, rules) => prefix + rules.replaceAll(/[^\s,]+/g, (rule) => renames[rule] ?? rule));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = process.argv.length > 2 ? process.argv.slice(2) : execFileSync('git', ['ls-files', '*.js', '*.jsx', '*.mjs', '*.cjs', '*.ts', '*.tsx', '*.mts', '*.cts'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const migrated = migrateSource(source);
    if (migrated !== source) {
      writeFileSync(file, migrated);
      console.log(file);
    }
  }
}
