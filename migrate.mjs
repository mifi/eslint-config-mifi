#!/usr/bin/env node
// Renames rules in eslint-disable/enable comments to their oxlint names in our config,
// e.g. `// eslint-disable-next-line import/no-extraneous-dependencies` -> `import-js/no-extraneous-dependencies`
// Usage: npx mifi-lint-migrate [files...] (defaults to all JS/TS files tracked by git)
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const config = JSON.parse(readFileSync(new URL('oxlintrc.json', import.meta.url), 'utf8'));

// Rules that were replaced by their native successor (see test/mapping.mjs)
export const replacedRules = { 'no-new-object': 'no-object-constructor' };

const renames = {
  ...replacedRules,
  // The original ESLint plugins are loaded as JS plugins aliased `<plugin>-js` (`eslint-js` being ESLint's core rules)
  ...Object.fromEntries(Object.keys(config.rules).flatMap((name) => {
    const match = name.match(/^(.+)-js\/(.+)$/);
    if (!match) return [];
    const [, plugin, rule] = match;
    return [[plugin === 'eslint' ? rule : `${plugin}/${rule}`, name]];
  })),
};

// The rule list ends at the end of the line (or comment), or at a `--` description
const lineDirective = /(\/\/[ \t]*eslint-(?:disable|enable)(?:-next-line|-line)?[ \t]+)(.*?)(?=[ \t]--|$)/gm;
const blockDirective = /(\/\*\s*eslint-(?:disable|enable)(?:-next-line|-line)?\s+)([\s\S]*?)(?=\s--|\*\/)/g;

const renameRules = (_, prefix, rules) => prefix + rules.replaceAll(/[^\s,]+/g, (rule) => renames[rule] ?? rule);

export default function migrateSource(source) {
  return source.replaceAll(lineDirective, renameRules).replaceAll(blockDirective, renameRules);
}

// when run as a script (e.g. through the bin symlink)
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
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
