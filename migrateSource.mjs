// Renames rules in eslint-disable/enable comments to their oxlint names in our config,
// e.g. `// eslint-disable-next-line import/no-extraneous-dependencies` -> `import-js/no-extraneous-dependencies`
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('oxlintrc.json', import.meta.url), 'utf8'));

// Rules that were replaced by their successor (see test/mapping.mjs)
export const replacedRules = {
  'consistent-return': 'typescript/consistent-return',
  'no-new-object': 'no-object-constructor',
  'react/no-unused-state': '@eslint-react/no-unused-state',
  'react/no-unused-class-component-methods': '@eslint-react/no-unused-class-component-members',
  'react/no-access-state-in-setstate': '@eslint-react/no-access-state-in-setstate',
};

const renames = new Map([
  ...Object.entries(replacedRules),
  // The original ESLint plugins are loaded as JS plugins aliased `<plugin>-js` (`eslint-js` being ESLint's core rules)
  ...Object.keys(config.rules).flatMap((name) => {
    const match = /^(.+)-js\/(.+)$/.exec(name);
    if (!match) return [];
    const [, plugin, rule] = match;
    return [[plugin === 'eslint' ? rule : `${plugin}/${rule}`, name]];
  }),
  // eslint-plugin-react's formatting rules moved to @stylistic
  ...Object.keys(config.rules).filter((name) => name.startsWith('@stylistic/jsx-')).map((name) => [name.replace('@stylistic/', 'react/'), name]),
]);

// The rule list ends at the end of the line (or comment), or at a `--` description
const lineDirective = /(\/\/[ \t]*eslint-(?:disable|enable)(?:-next-line|-line)?[ \t]+)(.*?)(?=[ \t]--|$)/gm;
const blockDirective = /(\/\*\s*eslint-(?:disable|enable)(?:-next-line|-line)?\s+)([\s\S]*?)(?=\s--|\*\/)/g;

const renameRules = (prefix, rules) => prefix + rules.replaceAll(/[^\s,]+/g, (rule) => renames.get(rule) ?? rule);

export default function migrateSource(source) {
  return source
    .replaceAll(lineDirective, (_, prefix, rules) => renameRules(prefix, rules))
    .replaceAll(blockDirective, (_, prefix, rules) => renameRules(prefix, rules));
}
