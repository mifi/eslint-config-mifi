// Maps rule names from the legacy ESLint config (see legacy/) to their oxlint equivalents.
// Shared by the parity tests (and used once to bootstrap oxlintrc.json).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export const oxlintBin = fileURLToPath(new URL('../node_modules/.bin/oxlint', import.meta.url));

const jsOnly = 'Only relevant for JavaScript (TypeScript checks this, or it is about prop-types/CommonJS)';
const deprecated = 'Deprecated upstream, and no longer considered good practice';

// Rules from the legacy config that we intentionally do not carry over
export const dropped = {
  'react-hooks/config': 'Only validates React Compiler configuration, which we don\'t pass to the linter',
  'react-hooks/gating': 'Only validates React Compiler gating configuration, which we don\'t pass to the linter',
  'no-return-await': `${deprecated}: \`return await\` is not slower and gives better stack traces`,
  'react/jsx-props-no-multi-spaces': `${deprecated}. Crashes under oxlint, and no-multi-spaces covers it`,
  strict: `${deprecated}: 'use strict' is meaningless in ES modules and TypeScript`,
  'lines-around-directive': deprecated,
  ...Object.fromEntries([
    // these read the exports of other modules, which tsc already checks (typescript-eslint recommends turning them off)
    'import/default', 'import/export', 'import/namespace', 'import/no-named-as-default', 'import/no-named-as-default-member',
    // CommonJS
    'global-require', 'no-new-require', 'no-path-concat', 'import/no-import-module-exports',
    // prop-types
    'react/forbid-prop-types', 'react/forbid-foreign-prop-types', 'react/default-props-match-prop-types', 'react/prefer-exact-props',
    // only needed by ESLint's no-unused-vars, oxlint's understands JSX
    'react/jsx-uses-vars',
    // syntax errors in ES modules and TypeScript
    'no-octal', 'no-octal-escape', 'no-dupe-args', 'no-new-symbol',
  ].map((rule) => [rule, jsOnly])),
};

// Rules from the legacy config that are replaced by their native successor (with the same severity)
export const replaced = {
  'no-new-object': { by: 'no-object-constructor', reason: `${deprecated}, replaced by no-object-constructor (which also flags \`Object()\`)` },
};

// Rules that are not in the legacy config, but recommended upstream (since airbnb was abandoned), and cause few changes in our projects
const fromConfigs = (source, rules) => Object.fromEntries(rules.map((rule) => [rule, source]));
export const added = {
  ...fromConfigs('eslint recommended', ['no-unassigned-vars', 'no-useless-assignment', 'preserve-caught-error']),
  ...fromConfigs('unicorn recommended', [
    'unicorn/consistent-date-clone', 'unicorn/consistent-template-literal-escape', 'unicorn/explicit-timer-delay', 'unicorn/no-accessor-recursion', 'unicorn/no-array-fill-with-reference-type',
    'unicorn/no-array-reverse', 'unicorn/no-array-sort', 'unicorn/no-confusing-array-with', 'unicorn/no-immediate-mutation', 'unicorn/no-instanceof-builtins', 'unicorn/no-unnecessary-array-flat-depth',
    'unicorn/no-unnecessary-array-splice-count', 'unicorn/no-unnecessary-slice-end', 'unicorn/no-useless-collection-argument', 'unicorn/no-useless-error-capture-stack-trace',
    'unicorn/no-useless-iterator-to-array', 'unicorn/prefer-bigint-literals', 'unicorn/prefer-class-fields', 'unicorn/prefer-classlist-toggle', 'unicorn/prefer-response-static-json',
    'unicorn/prefer-single-call', 'unicorn/require-module-attributes', 'unicorn/require-module-specifiers', 'unicorn/switch-case-break-position',
  ]),
  // these need type information (oxlint --type-aware)
  ...fromConfigs('typescript-eslint strict-type-checked', [
    'typescript/await-thenable', 'typescript/no-array-delete', 'typescript/no-base-to-string', 'typescript/no-for-in-array', 'typescript/no-generated-empty-object-type', 'typescript/no-implied-eval',
    'typescript/no-meaningless-void-operator', 'typescript/no-misused-spread', 'typescript/no-mixed-enums', 'typescript/no-unnecessary-template-expression', 'typescript/no-unnecessary-type-arguments',
    'typescript/no-unnecessary-type-parameters', 'typescript/no-unsafe-call', 'typescript/no-unsafe-enum-comparison', 'typescript/no-unsafe-unary-minus', 'typescript/no-useless-default-assignment',
    'typescript/only-throw-error', 'typescript/prefer-promise-reject-errors', 'typescript/prefer-reduce-type-parameter', 'typescript/prefer-return-this-type', 'typescript/related-getter-setter-pairs',
    'typescript/restrict-plus-operands', 'typescript/return-await', 'typescript/use-unknown-in-catch-callback-variable',
  ]),
  // relative imports need explicit extensions when run without a bundler (e.g. Node's type stripping), like `./util.ts`
  'import/extensions': 'explicit extensions in relative imports',
  ...fromConfigs('typescript-eslint stylistic-type-checked', ['typescript/non-nullable-type-assertion-style', 'typescript/prefer-find', 'typescript/prefer-includes', 'typescript/prefer-string-starts-ends-with']),
};

// Native oxlint rules that don't behave like the original, so we load the original ESLint rule as a JS plugin instead
const preferJsPlugin = {
  'react/jsx-no-duplicate-props': 'oxlint doesn\'t support the ignoreCase option',
};

// Options changed from the legacy config (to what oxlint's native rule accepts, or to be stricter), keyed by legacy rule name
const adaptedOptions = {
  '@typescript-eslint/consistent-type-assertions': {
    reason: 'stricter: type assertions are unchecked, so avoid them (use a disable comment where one is really needed)',
    adapt: ([severity]) => [severity, { assertionStyle: 'never' }],
  },
  'import/no-cycle': {
    reason: 'oxlint wants maxDepth as a number (unlimited is the default anyway) and has no disableScc (a perf option). eslint-plugin-import always ignores type imports',
    adapt: ([severity, options]) => [severity, { ...Object.fromEntries(Object.entries(options).filter(([key]) => !['maxDepth', 'disableScc'].includes(key))), ignoreTypes: true }],
  },
};

// ESLint plugin name -> oxlint native plugin name (oxlint folds react-hooks into react)
const nativePlugins = { '': '', '@typescript-eslint': 'typescript', react: 'react', 'react-hooks': 'react', import: 'import', unicorn: 'unicorn', 'jsx-a11y': 'jsx-a11y' };

// ESLint plugin name -> alias of the same ESLint plugin loaded as an oxlint JS plugin (native plugin names are reserved)
const jsPluginAliases = { '': 'eslint-js', react: 'react-js', import: 'import-js', unicorn: 'unicorn-js' };

const splitRuleName = (name) => {
  const i = name.lastIndexOf('/');
  return i === -1 ? ['', name] : [name.slice(0, i), name.slice(i + 1)];
};

export const extensions = ['js', 'cjs', 'mjs', 'jsx', 'ts', 'tsx', 'mts', 'cts'];

const legacyDir = new URL('../legacy/', import.meta.url);

const severities = { 0: 'off', 1: 'warn', 2: 'error' };

const legacyConfigs = new Map();

function loadLegacyConfig(ext) {
  const config = JSON.parse(execFileSync('node_modules/.bin/eslint', ['--no-eslintrc', '-c', 'eslintrc.cjs', '--print-config', `file.${ext}`], { cwd: legacyDir, encoding: 'utf8' }));
  const rules = Object.fromEntries(Object.entries(config.rules).flatMap(([name, value]) => {
    const [severity, ...options] = Array.isArray(value) ? value : [value];
    const normalized = severities[severity] ?? severity;
    return normalized === 'off' ? [] : [[name, [normalized, ...options]]];
  }));
  return { ...config, rules };
}

// Effective config of the legacy ESLint config for a file with the given extension, with only enabled rules (normalized to [severity, ...options])
export function getLegacyConfig(ext) {
  if (!legacyConfigs.has(ext)) legacyConfigs.set(ext, loadLegacyConfig(ext));
  return legacyConfigs.get(ext);
}

export function getNativeRules() {
  // with an empty config, so that it doesn't depend on (or fail because of) our own config
  const emptyConfig = join(mkdtempSync(join(tmpdir(), 'oxlint-')), '.oxlintrc.json');
  writeFileSync(emptyConfig, '{}');
  const rules = JSON.parse(execFileSync(oxlintBin, ['-c', emptyConfig, '--rules', '--format=json'], { encoding: 'utf8' }));
  return new Set(rules.map(({ scope, value }) => (scope === 'eslint' ? value : `${scope.replaceAll('_', '-')}/${value}`)));
}

function toOxlintRuleName(eslintName, nativeRules) {
  const [plugin, rule] = splitRuleName(eslintName);

  const nativePlugin = nativePlugins[plugin];
  if (nativePlugin != null && !preferJsPlugin[eslintName]) {
    const native = nativePlugin ? `${nativePlugin}/${rule}` : rule;
    if (nativeRules.has(native)) return native;
  }
  // TS versions of core rules are covered by oxlint's (TS-aware) core rules
  if (plugin === '@typescript-eslint' && nativeRules.has(rule)) return rule;
  // ESLint's deprecated Node.js core rules live in oxlint's node plugin
  if (plugin === '' && nativeRules.has(`node/${rule}`)) return `node/${rule}`;

  const alias = jsPluginAliases[plugin];
  if (alias) return `${alias}/${rule}`;
  throw new Error(`No oxlint equivalent for ${eslintName}`);
}

const stylisticRules = new Set(Object.keys(require('@stylistic/eslint-plugin').rules));
const ruleMetas = {
  '': require('eslint/use-at-your-own-risk').builtinRules,
  react: new Map(Object.entries(require('eslint-plugin-react').rules)),
  unicorn: new Map(Object.entries(require('eslint-plugin-unicorn').rules)),
};

// Formatting rules (the ones that moved to @stylistic, or of the layout type) are warnings, so that they stand out from real problems
function isStylistic(eslintName) {
  const [plugin, rule] = splitRuleName(eslintName);
  return (['', 'react'].includes(plugin) && stylisticRules.has(rule)) || ruleMetas[plugin]?.get(rule)?.meta?.type === 'layout';
}

// Returns the expected oxlint [name, [severity, ...options]] for a legacy ESLint rule, or undefined if dropped
export function toOxlintRule(eslintName, [severity, ...options], nativeRules) {
  if (dropped[eslintName]) return undefined;
  if (replaced[eslintName]) return [replaced[eslintName].by, [severity]];
  const value = [isStylistic(eslintName) ? 'warn' : severity, ...options];
  return [toOxlintRuleName(eslintName, nativeRules), adaptedOptions[eslintName]?.adapt(value) ?? value];
}
