// Renames rules in eslint-disable/enable comments to their oxlint names in our config,
// e.g. `// eslint-disable-next-line import/no-extraneous-dependencies` -> `import-js/no-extraneous-dependencies`
import config from './oxlintrc.json' with { type: 'json' };

// Rules that were replaced by their successor (see test/mapping.ts)
export const replacedRules = {
  'consistent-return': 'typescript/consistent-return',
  'no-new-object': 'no-object-constructor',
  'react/no-unused-state': '@eslint-react/no-unused-state',
  'react/no-unused-class-component-methods': '@eslint-react/no-unused-class-component-members',
  'react/no-access-state-in-setstate': '@eslint-react/no-access-state-in-setstate',
};

const renames = new Map(Object.entries(replacedRules));
for (const name of Object.keys(config.rules)) {
  // The original ESLint plugins are loaded as JS plugins aliased `<plugin>-js` (`eslint-js` being ESLint's core rules)
  const [, plugin, rule] = /^(.+)-js\/(.+)$/.exec(name) ?? [];
  if (plugin != null && rule != null) renames.set(plugin === 'eslint' ? rule : `${plugin}/${rule}`, name);

  // ESLint's core formatting rules and eslint-plugin-react's formatting rules moved to @stylistic
  if (!name.startsWith('@stylistic/')) continue;
  const stylisticRule = name.slice('@stylistic/'.length);
  if (stylisticRule.startsWith('jsx-')) {
    renames.set(`react/${stylisticRule}`, name);
    continue;
  }
  const coreRule = stylisticRule === 'function-call-spacing' ? 'func-call-spacing' : stylisticRule;
  renames.set(coreRule, name);
  // also the eslint-js/ names that an earlier version of this config used
  renames.set(`eslint-js/${coreRule}`, name);
}

// The rule list ends at the end of the line (or comment), or at a `--` description
const lineDirective = /(\/\/[ \t]*eslint-(?:disable|enable)(?:-next-line|-line)?[ \t]+)(.*?)(?=[ \t]--|$)/gm;
const blockDirective = /(\/\*\s*eslint-(?:disable|enable)(?:-next-line|-line)?\s+)([\s\S]*?)(?=\s--|\*\/)/g;

/** @type {(prefix: string, rules: string) => string} */
const renameRules = (prefix, rules) => prefix + rules.replaceAll(/[^\s,]+/g, (rule) => renames.get(rule) ?? rule);

/** @param {string} source */
export default function migrateSource(source) {
  return source
    .replaceAll(lineDirective, (/** @type {string} */ _, /** @type {string} */ prefix, /** @type {string} */ rules) => renameRules(prefix, rules))
    .replaceAll(blockDirective, (/** @type {string} */ _, /** @type {string} */ prefix, /** @type {string} */ rules) => renameRules(prefix, rules));
}
