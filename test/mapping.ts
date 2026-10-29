// Maps rule names from the legacy ESLint config (see legacy/) to their oxlint equivalents.
// Shared by the parity tests (and used once to bootstrap oxlintrc.json).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import stylistic from '@stylistic/eslint-plugin';
import { builtinRules } from 'eslint/use-at-your-own-risk';
import unicorn from 'eslint-plugin-unicorn';

import { replacedRules, stylisticRenames } from '../migrateSource.mjs';

// eslint-disable-next-line typescript/no-unsafe-return, typescript/no-unnecessary-type-parameters -- for JSON from trusted sources (our own config and tools)
export const parseJson = <T>(text: string): T => JSON.parse(text);

export const oxlintBin = fileURLToPath(new URL('../node_modules/.bin/oxlint', import.meta.url));

type Severity = 'off' | 'warn' | 'error';
// [severity, ...options]
export type RuleValue = [Severity, ...unknown[]];
type Settings = Record<string, unknown>;
export interface LegacyConfig {
  rules: Record<string, RuleValue>;
  settings: Settings & { 'import/resolver': { node: { extensions: string[] } } };
}

const isObject = (value: unknown): value is Record<string, unknown> => value != null && typeof value === 'object' && !Array.isArray(value);
const asObject = (value: unknown) => (isObject(value) ? value : {});
const toArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [value]);
const omit = (object: unknown, keys: string[]) => Object.fromEntries(Object.entries(asObject(object)).filter(([key]) => !keys.includes(key)));

const jsOnly = 'Only relevant for JavaScript (TypeScript checks this, or it is about prop-types/CommonJS)';
const deprecated = 'Deprecated upstream, and no longer considered good practice';

// Rules from the legacy config that we intentionally do not carry over
export const dropped: Record<string, string> = {
  'react-hooks/config': 'Only validates React Compiler configuration, which we don\'t pass to the linter',
  'react-hooks/gating': 'Only validates React Compiler gating configuration, which we don\'t pass to the linter',
  'no-return-await': `${deprecated}: \`return await\` is not slower and gives better stack traces`,
  'react/jsx-props-no-multi-spaces': `${deprecated}. Crashes under oxlint, and no-multi-spaces covers it`,
  'react/jsx-indent': `${deprecated}, @stylistic/indent handles JSX`,
  strict: `${deprecated}: 'use strict' is meaningless in ES modules and TypeScript`,
  'lines-around-directive': deprecated,
  'no-continue': 'Conflicts with unicorn/prefer-continue (an early `continue` is considered good style now)',
  'import/prefer-default-export': 'Not considered good practice anymore (named exports are easier to refactor and auto-import)',
  'react/jsx-props-no-spreading': 'Not considered good practice anymore (spreading is how props are passed through, and TypeScript checks them)',
  'no-buffer-constructor': `${deprecated}, typescript/no-deprecated flags \`new Buffer()\``,
  'unicorn/no-array-push-push': `${deprecated}, replaced by unicorn/prefer-single-call`,
  'unicorn/no-instanceof-array': `${deprecated}, replaced by unicorn/no-instanceof-builtins`,
  'unicorn/no-length-as-slice-end': `${deprecated}, replaced by unicorn/no-unnecessary-slice-end`,
  'unicorn/prefer-dom-node-dataset': `${deprecated}, replaced by unicorn/dom-node-dataset`,
  'unicorn/no-hex-escape': `${deprecated}, replaced by unicorn/prefer-unicode-code-point-escapes (which conflicts with it)`,
  // eslint-plugin-react isn't maintained anymore (and doesn't support ESLint 10). Rules without a native or @eslint-react equivalent:
  'react/no-deprecated': 'Covered by typescript/no-deprecated (React\'s types mark deprecated APIs)',
  'react/no-typos': 'Mostly caught by TypeScript',
  'react/jsx-no-bind': 'Mostly a performance concern, which the React Compiler takes care of',
  'react/no-unused-prop-types': 'Its @eslint-react successor (no-unused-props) needs type information, which oxlint doesn\'t give JS plugins',
  'react/no-invalid-html-attribute': 'Only checks values like `rel`, not worth keeping eslint-plugin-react for',
  ...Object.fromEntries(['react/prefer-stateless-function', 'react/static-property-placement', 'react/no-arrow-function-lifecycle', 'react/destructuring-assignment']
    .map((rule) => [rule, 'Only about class components (react/prefer-function-component bans them)'])),
  ...Object.fromEntries([
    // these read the exports of other modules, which tsc already checks (typescript-eslint recommends turning them off)
    'import/default', 'import/export', 'import/namespace', 'import/no-named-as-default', 'import/no-named-as-default-member',
    // CommonJS
    'global-require', 'no-new-require', 'import/no-import-module-exports',
    // prop-types
    'react/forbid-prop-types', 'react/forbid-foreign-prop-types', 'react/default-props-match-prop-types', 'react/prefer-exact-props',
    // only needed by ESLint's no-unused-vars, oxlint's understands JSX
    'react/jsx-uses-vars',
    // syntax errors in ES modules and TypeScript
    'no-octal', 'no-octal-escape', 'no-dupe-args', 'no-new-symbol',
    // checked by TypeScript (turned off for TS files by typescript-eslint's eslint-recommended config)
    'constructor-super', 'getter-return', 'no-class-assign', 'no-const-assign', 'no-dupe-class-members', 'no-dupe-keys', 'no-func-assign',
    'no-import-assign', 'no-obj-calls', 'no-redeclare', 'no-setter-return', 'no-this-before-super', 'no-undef', 'no-unreachable', 'no-unsafe-negation', 'no-with',
  ].map((rule) => [rule, jsOnly])),
};

// Rules from the legacy config that are replaced by their native successor
// (their successors are in migrateSource.mjs, which renames them in disable comments)
const replacedReasons: Record<keyof typeof replacedRules, string> = {
  'consistent-return': 'The native, type-aware version (understands void)',
  'no-new-object': `${deprecated}, replaced by no-object-constructor (which also flags \`Object()\`)`,
  // eslint-plugin-react isn't maintained anymore (and doesn't support ESLint 10), @eslint-react is
  'react/no-unused-state': 'eslint-plugin-react -> @eslint-react',
  'react/no-unused-class-component-methods': 'eslint-plugin-react -> @eslint-react',
  'react/no-access-state-in-setstate': 'eslint-plugin-react -> @eslint-react',
};
const replacedBy = new Map(Object.entries(replacedRules));
export const replaced: Record<string, { by: string, reason: string }> = Object.fromEntries(Object.entries(replacedReasons).map(([name, reason]) => [name, { by: replacedBy.get(name) ?? name, reason }]));

// Rules that are not in the legacy config, but recommended upstream (since airbnb was abandoned), and cause few changes in our projects
const fromConfigs = (source: string, rules: string[]) => Object.fromEntries(rules.map((rule) => [rule, source]));
export const added: Record<string, string> = {
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
    'typescript/await-thenable', 'typescript/no-array-delete', 'typescript/no-base-to-string', 'typescript/no-deprecated', 'typescript/no-for-in-array', 'typescript/no-generated-empty-object-type', 'typescript/no-implied-eval',
    'typescript/no-meaningless-void-operator', 'typescript/no-misused-spread', 'typescript/no-mixed-enums', 'typescript/no-unnecessary-template-expression', 'typescript/no-unnecessary-type-arguments',
    'typescript/no-unnecessary-type-parameters', 'typescript/no-unsafe-call', 'typescript/no-unsafe-enum-comparison', 'typescript/no-unsafe-unary-minus', 'typescript/no-useless-default-assignment',
    'typescript/only-throw-error', 'typescript/prefer-promise-reject-errors', 'typescript/prefer-reduce-type-parameter', 'typescript/prefer-return-this-type', 'typescript/related-getter-setter-pairs',
    'typescript/restrict-plus-operands', 'typescript/return-await', 'typescript/use-unknown-in-catch-callback-variable',
  ]),
  ...fromConfigs('typescript-eslint strict-type-checked, stylistic-type-checked and more (stage 2)', [
    'typescript/no-confusing-void-expression', 'typescript/no-misused-promises', 'typescript/no-floating-promises', 'typescript/no-unnecessary-condition',
    'typescript/no-unsafe-assignment', 'typescript/no-unsafe-member-access', 'typescript/no-unsafe-argument', 'typescript/no-unsafe-return',
    'typescript/prefer-nullish-coalescing', 'typescript/prefer-regexp-exec', 'typescript/require-await', 'typescript/restrict-template-expressions',
    'typescript/prefer-optional-chain', 'typescript/no-duplicate-type-constituents', 'typescript/no-unnecessary-type-conversion', 'typescript/unbound-method',
    'typescript/no-redundant-type-constituents', 'typescript/no-unnecessary-boolean-literal-compare', 'typescript/no-unnecessary-type-assertion',
    'typescript/dot-notation', 'typescript/switch-exhaustiveness-check', 'typescript/strict-boolean-expressions', 'typescript/prefer-readonly',
    'typescript/consistent-type-exports',
  ]),
  ...fromConfigs('unicorn recommended (stage 2)', [
    'unicorn/consistent-assert', 'unicorn/max-nested-calls', 'unicorn/prefer-number-coercion',
  ]),
  // unicorn's recommended rules (v79) that oxlint doesn't implement natively, run with the JS plugin. Except the successors of rules
  // that the legacy config turned off on purpose: name-replacements (prevent-abbreviations) and no-for-each (no-array-for-each).
  // Rules with default options have them set explicitly in oxlintrc.json, because oxlint's JS plugins don't apply meta.defaultOptions
  ...fromConfigs('unicorn recommended (stage 2, JS plugin)', [
    'unicorn-js/better-dom-traversing', 'unicorn-js/class-reference-in-static-methods', 'unicorn-js/consistent-boolean-name', 'unicorn-js/consistent-class-member-order',
    'unicorn-js/consistent-compound-words', 'unicorn-js/consistent-conditional-object-spread', 'unicorn-js/consistent-export-decorator-position',
    'unicorn-js/consistent-json-file-read', 'unicorn-js/consistent-optional-chaining', 'unicorn-js/consistent-tuple-labels', 'unicorn-js/default-export-style',
    'unicorn-js/dom-node-dataset', 'unicorn-js/isolated-functions', 'unicorn-js/no-accidental-bitwise-operator',
    'unicorn-js/no-array-concat-in-loop', 'unicorn-js/no-array-from-fill', 'unicorn-js/no-array-sort-for-min-max', 'unicorn-js/no-array-splice',
    'unicorn-js/no-asterisk-prefix-in-documentation-comments', 'unicorn-js/no-async-iterator-callback', 'unicorn-js/no-async-promise-finally',
    'unicorn-js/no-blob-to-file', 'unicorn-js/no-boolean-sort-comparator', 'unicorn-js/no-break-in-nested-loop', 'unicorn-js/no-canvas-to-image',
    'unicorn-js/no-chained-comparison', 'unicorn-js/no-collection-bracket-access', 'unicorn-js/no-computed-property-existence-check',
    'unicorn-js/no-conflicting-constraints', 'unicorn-js/no-confusing-array-splice', 'unicorn-js/no-constant-zero-expression',
    'unicorn-js/no-declarations-before-early-exit', 'unicorn-js/no-double-comparison', 'unicorn-js/no-duplicate-if-branches', 'unicorn-js/no-duplicate-logical-operands',
    'unicorn-js/no-duplicate-loops', 'unicorn-js/no-duplicate-set-values', 'unicorn-js/no-error-property-assignment', 'unicorn-js/no-exports-in-scripts',
    'unicorn-js/no-global-object-property-assignment', 'unicorn-js/no-impossible-length-comparison', 'unicorn-js/no-incomplete-accessor-override',
    'unicorn-js/no-incorrect-query-selector', 'unicorn-js/no-incorrect-template-string-interpolation', 'unicorn-js/no-ineffective-csp-directives',
    'unicorn-js/no-invalid-argument-count', 'unicorn-js/no-invalid-boolean-attribute-value', 'unicorn-js/no-invalid-character-comparison',
    'unicorn-js/no-invalid-dom-token', 'unicorn-js/no-invalid-integrity', 'unicorn-js/no-invalid-intl-options', 'unicorn-js/no-invalid-property-descriptor',
    'unicorn-js/no-invalid-response-options', 'unicorn-js/no-invalid-style-set-property', 'unicorn-js/no-invalid-temporal-arithmetic',
    'unicorn-js/no-invalid-url-protocol-comparison', 'unicorn-js/no-invalid-well-known-symbol-methods', 'unicorn-js/no-late-current-target-access',
    'unicorn-js/no-late-event-control', 'unicorn-js/no-leading-empty-lines', 'unicorn-js/no-loop-iterable-mutation', 'unicorn-js/no-mismatched-map-key',
    'unicorn-js/no-misrefactored-assignment', 'unicorn-js/no-multiple-promise-resolver-calls', 'unicorn-js/no-named-default', 'unicorn-js/no-negated-array-predicate',
    'unicorn-js/no-negated-comparison', 'unicorn-js/no-non-function-verb-prefix', 'unicorn-js/no-nonstandard-builtin-properties',
    'unicorn-js/no-object-methods-with-collections', 'unicorn-js/no-optional-chaining-on-undeclared-variable', 'unicorn-js/no-prevent-default-in-passive-listener',
    'unicorn-js/no-redundant-comparison', 'unicorn-js/no-return-array-push', 'unicorn-js/no-selector-as-dom-name', 'unicorn-js/no-shorthand-property-overrides',
    'unicorn-js/no-subtraction-comparison', 'unicorn-js/no-this-outside-of-class', 'unicorn-js/no-top-level-assignment-in-function',
    'unicorn-js/no-top-level-side-effects', 'unicorn-js/no-transition-all', 'unicorn-js/no-uncalled-method', 'unicorn-js/no-undeclared-class-members',
    'unicorn-js/no-unnecessary-array-flat-map', 'unicorn-js/no-unnecessary-boolean-comparison', 'unicorn-js/no-unnecessary-fetch-options',
    'unicorn-js/no-unnecessary-global-this', 'unicorn-js/no-unnecessary-nested-ternary', 'unicorn-js/no-unnecessary-parameters', 'unicorn-js/no-unnecessary-splice',
    'unicorn-js/no-unnecessary-string-trim', 'unicorn-js/no-unreadable-for-of-expression', 'unicorn-js/no-unreadable-object-destructuring',
    'unicorn-js/no-unsafe-buffer-conversion', 'unicorn-js/no-unsafe-json-serialization', 'unicorn-js/no-unsafe-promise-all-settled-values',
    'unicorn-js/no-unsafe-property-key', 'unicorn-js/no-unsafe-sqlite-interpolation', 'unicorn-js/no-unsafe-string-replacement',
    'unicorn-js/no-unused-builtin-method-return', 'unicorn-js/no-unused-iterator-helper', 'unicorn-js/no-url-in-search-params', 'unicorn-js/no-useless-boolean-cast',
    'unicorn-js/no-useless-coercion', 'unicorn-js/no-useless-compound-assignment', 'unicorn-js/no-useless-continue',
    'unicorn-js/no-useless-delete-check', 'unicorn-js/no-useless-else', 'unicorn-js/no-useless-logical-operand', 'unicorn-js/no-useless-override',
    'unicorn-js/no-useless-re-export', 'unicorn-js/no-useless-recursion', 'unicorn-js/no-useless-set-construction', 'unicorn-js/no-useless-template-literals',
    'unicorn-js/no-using-resource-escape', 'unicorn-js/no-xor-as-exponentiation', 'unicorn-js/prefer-abort-signal-any',
    'unicorn-js/prefer-abort-signal-timeout', 'unicorn-js/prefer-add-event-listener-options', 'unicorn-js/prefer-aggregate-error', 'unicorn-js/prefer-array-from-async',
    'unicorn-js/prefer-array-from-map', 'unicorn-js/prefer-array-from-range', 'unicorn-js/prefer-array-iterable-methods', 'unicorn-js/prefer-array-last-methods',
    'unicorn-js/prefer-array-slice', 'unicorn-js/prefer-await', 'unicorn-js/prefer-block-statement-over-iife', 'unicorn-js/prefer-boolean-return',
    'unicorn-js/prefer-combined-guards', 'unicorn-js/prefer-continue', 'unicorn-js/prefer-direct-iteration', 'unicorn-js/prefer-dom-node-html-methods',
    'unicorn-js/prefer-dom-node-replace-children', 'unicorn-js/prefer-early-return', 'unicorn-js/prefer-else-if', 'unicorn-js/prefer-escaped-irregular-whitespace',
    'unicorn-js/prefer-flat-math-min-max', 'unicorn-js/prefer-get-or-insert-computed', 'unicorn-js/prefer-global-number-constants', 'unicorn-js/prefer-group-by',
    'unicorn-js/prefer-has-check', 'unicorn-js/prefer-https', 'unicorn-js/prefer-identifier-import-export-specifiers',
    'unicorn-js/prefer-includes-over-repeated-comparisons', 'unicorn-js/prefer-iterable-in-constructor', 'unicorn-js/prefer-iterator-helpers',
    'unicorn-js/prefer-iterator-to-array', 'unicorn-js/prefer-iterator-to-array-at-end', 'unicorn-js/prefer-iterator-zip', 'unicorn-js/prefer-literal-ascii',
    'unicorn-js/prefer-location-assign', 'unicorn-js/prefer-map-from-entries', 'unicorn-js/prefer-math-abs', 'unicorn-js/prefer-math-constants',
    'unicorn-js/prefer-minimal-ternary', 'unicorn-js/prefer-number-is-safe-integer', 'unicorn-js/prefer-object-define-properties',
    'unicorn-js/prefer-object-destructuring-defaults', 'unicorn-js/prefer-object-iterable-methods', 'unicorn-js/prefer-observer-apis', 'unicorn-js/prefer-path2d',
    'unicorn-js/prefer-private-class-fields', 'unicorn-js/prefer-promise-static-methods', 'unicorn-js/prefer-promise-try', 'unicorn-js/prefer-promise-with-resolvers',
    'unicorn-js/prefer-queue-microtask', 'unicorn-js/prefer-scoped-selector', 'unicorn-js/prefer-set-methods', 'unicorn-js/prefer-short-escape-sequences',
    'unicorn-js/prefer-simple-condition-first', 'unicorn-js/prefer-simple-sort-comparator', 'unicorn-js/prefer-simplified-conditions',
    'unicorn-js/prefer-single-array-predicate', 'unicorn-js/prefer-single-object-destructuring', 'unicorn-js/prefer-single-replace', 'unicorn-js/prefer-smaller-scope',
    'unicorn-js/prefer-split-limit', 'unicorn-js/prefer-string-match-all', 'unicorn-js/prefer-string-pad-start-end', 'unicorn-js/prefer-string-repeat',
    'unicorn-js/prefer-temporal-conversion', 'unicorn-js/prefer-then-catch', 'unicorn-js/prefer-toggle-attribute', 'unicorn-js/prefer-type-literal-last',
    'unicorn-js/prefer-unary-minus', 'unicorn-js/prefer-unicode-code-point-escapes', 'unicorn-js/prefer-url-can-parse', 'unicorn-js/prefer-url-href',
    'unicorn-js/prefer-url-search-parameters', 'unicorn-js/prefer-while-loop-condition', 'unicorn-js/require-css-escape',
    'unicorn-js/require-passive-events', 'unicorn-js/require-proxy-trap-boolean-return', 'unicorn-js/require-text-decoder-streaming',
    'unicorn-js/single-line-block-comment-style',
  ]),
  // @eslint-react's strict-type-checked rules, except the ones that duplicate native oxlint rules we have enabled, and the ones that need
  // type information (no-unused-props, no-leaked-conditional-rendering), which oxlint doesn't give JS plugins
  ...fromConfigs('@eslint-react strict-type-checked', [
    '@eslint-react/no-component-will-mount', '@eslint-react/no-component-will-receive-props',
    '@eslint-react/no-component-will-update', '@eslint-react/no-context-provider', '@eslint-react/no-create-ref', '@eslint-react/no-forward-ref',
    '@eslint-react/no-nested-lazy-component-declarations', '@eslint-react/no-unnecessary-use-prefix',
    '@eslint-react/no-use-context', '@eslint-react/use-state', '@eslint-react/jsx-no-children-prop-with-children', '@eslint-react/jsx-no-key-after-spread',
    '@eslint-react/jsx-no-leaked-dollar', '@eslint-react/jsx-no-leaked-semicolon', '@eslint-react/rsc-function-definition', '@eslint-react/dom-no-flush-sync',
    '@eslint-react/dom-no-hydrate', '@eslint-react/dom-no-render', '@eslint-react/dom-no-unsafe-iframe-sandbox', '@eslint-react/dom-no-use-form-state',
    '@eslint-react/web-api-no-leaked-event-listener', '@eslint-react/web-api-no-leaked-fetch', '@eslint-react/web-api-no-leaked-intersection-observer',
    '@eslint-react/web-api-no-leaked-interval', '@eslint-react/web-api-no-leaked-resize-observer', '@eslint-react/web-api-no-leaked-timeout',
    '@eslint-react/naming-convention-context-name', '@eslint-react/naming-convention-id-name', '@eslint-react/naming-convention-ref-name',
    '@eslint-react/no-misused-capture-owner-stack',

  ]),
  // native oxlint rules: the promise and vitest plugins (correctness and suspicious categories), oxc performance rules, and native
  // versions of two @eslint-react rules (dom-no-missing-iframe-sandbox, no-unstable-default-props)
  ...fromConfigs('oxlint', [
    'promise/always-return', 'promise/no-callback-in-promise', 'promise/no-multiple-resolved', 'promise/no-new-statics', 'promise/no-promise-in-callback',
    'promise/valid-params', 'vitest/expect-expect', 'vitest/hoisted-apis-on-top', 'vitest/no-commented-out-tests', 'vitest/no-conditional-expect',
    'vitest/no-conditional-tests', 'vitest/no-disabled-tests', 'vitest/no-focused-tests', 'vitest/no-standalone-expect', 'vitest/prefer-snapshot-hint',
    'vitest/require-awaited-expect-poll', 'vitest/require-local-test-context-for-concurrent-snapshots', 'vitest/require-mock-type-parameters',
    'vitest/require-to-throw-message', 'vitest/valid-describe-callback', 'vitest/valid-expect', 'vitest/valid-expect-in-promise', 'vitest/valid-title',
    'vitest/warn-todo', 'oxc/no-accumulating-spread', 'oxc/no-map-spread', 'react/iframe-missing-sandbox', 'react/no-object-type-as-default-prop',
    'react/exhaustive-effect-dependencies', 'react/hooks', 'react/memo-dependencies', 'react/no-deriving-state-in-effects', 'no-unmodified-loop-condition',
    'unicorn/require-post-message-target-origin', 'oxc/no-async-endpoint-handlers', 'jsx-a11y/prefer-tag-over-role',
  ]),
  // the rest of oxlint's correctness and suspicious rules, and the pedantic, style and restriction rules that fit (few findings, not opinionated
  // about layout or naming). Some of them replace slower JS plugin rules:
  // - unicorn's duplicates of native rules: logical-assignment-operators, no-useless-concat, operator-assignment, require-array-sort-compare,
  //   prefer-hoisting-branch-code (oxc/branches-sharing-code)
  // - @eslint-react's no-children-* (react/no-react-children), no-clone-element, no-class-component (react/prefer-function-component, which allows
  //   error boundaries), no-unsafe-component-will-* (react/no-unsafe) and no-set-state-in-component-did-mount (react/no-did-mount-set-state)
  ...fromConfigs('oxlint (more native rules)', [
    'oxc/bad-array-method-on-arguments', 'oxc/bad-char-at-comparison', 'oxc/bad-comparison-sequence', 'oxc/bad-match-all-arg',
    'oxc/bad-min-max-func', 'oxc/bad-object-literal-comparison', 'oxc/bad-replace-all-arg', 'oxc/const-comparisons',
    'oxc/double-comparisons', 'oxc/erasing-op', 'oxc/missing-throw', 'oxc/number-arg-out-of-range', 'oxc/only-used-in-recursion',
    'oxc/uninvoked-array-callback', 'oxc/approx-constant', 'oxc/misrefactored-assign-op', 'oxc/no-this-in-exported-function',
    'oxc/branches-sharing-code', 'react/forward-ref-uses-ref', 'react/jsx-props-no-spread-multi', 'react/no-did-mount-set-state',
    'react/no-unsafe', 'react/void-use-memo', 'react/capitalized-calls', 'react/checked-requires-onchange-or-readonly',
    'react/no-clone-element', 'react/no-react-children', 'react/prefer-function-component', 'react/only-export-components',
    'typescript/no-unnecessary-parameter-property-assignment', 'typescript/no-useless-empty-export',
    'typescript/require-array-sort-compare', 'typescript/consistent-type-imports', 'typescript/no-import-type-side-effects',
    'typescript/no-unnecessary-qualifier', 'typescript/prefer-enum-initializers',
    'typescript/promise-function-async', 'jsx-a11y/no-aria-hidden-on-focusable', 'jsx-a11y/anchor-ambiguous-text', 'node/no-exports-assign',
    'import/no-empty-named-blocks', 'import/consistent-type-specifier-style', 'promise/no-return-in-finally',
    'promise/param-names', 'promise/no-nesting', 'promise/no-return-wrap', 'promise/prefer-catch', 'promise/prefer-await-to-then',
    'no-useless-call', 'no-implicit-coercion', 'logical-assignment-operators', 'accessor-pairs',
    'unicorn/consistent-function-scoping', 'unicorn/prefer-import-meta-properties',
    'vitest/prefer-strict-equal', 'vitest/prefer-to-be', 'vitest/prefer-expect-resolves',
    'vitest/no-alias-methods', 'vitest/no-duplicate-hooks', 'vitest/no-identical-title', 'vitest/no-test-prefixes',
    'vitest/no-test-return-statement', 'vitest/no-mocks-import', 'vitest/no-unneeded-async-expect-function',
    'vitest/no-interpolation-in-snapshots', 'vitest/prefer-comparison-matcher', 'vitest/prefer-equality-matcher',
    'vitest/prefer-to-contain', 'vitest/prefer-to-have-length', 'vitest/prefer-hooks-on-top', 'vitest/prefer-hooks-in-order',
    'vitest/prefer-mock-promise-shorthand', 'vitest/prefer-mock-return-shorthand', 'vitest/prefer-spy-on', 'vitest/prefer-todo',
    'vitest/prefer-to-be-object', 'vitest/consistent-vitest-vi', 'vitest/prefer-expect-type-of',
  ]),
  // relative imports need explicit extensions when run without a bundler (e.g. Node's type stripping), like `./util.ts`
  'import/extensions': 'explicit extensions in relative imports',
  ...fromConfigs('typescript-eslint stylistic-type-checked', ['typescript/non-nullable-type-assertion-style', 'typescript/prefer-find', 'typescript/prefer-includes', 'typescript/prefer-string-starts-ends-with']),
};

// Options changed from the legacy config (to what oxlint's native rule accepts, or to be stricter), keyed by legacy rule name
const adaptedOptions: Record<string, { reason: string, adapt: (value: RuleValue) => RuleValue }> = {
  '@typescript-eslint/consistent-type-assertions': {
    reason: 'stricter: type assertions are unchecked, so avoid them (use a disable comment where one is really needed)',
    adapt: ([severity]) => [severity, { assertionStyle: 'never' }],
  },
  'react/jsx-no-duplicate-props': {
    reason: 'oxlint\'s native rule doesn\'t support the ignoreCase option (props that only differ in case)',
    adapt: ([severity]) => [severity],
  },
  'no-param-reassign': {
    reason: 'also allow mutating `draft` (immer)',
    adapt: ([severity, options]) => {
      const { ignorePropertyModificationsFor } = asObject(options);
      return [severity, { ...asObject(options), ignorePropertyModificationsFor: [...toArray(ignorePropertyModificationsFor ?? []), 'draft'] }];
    },
  },
  indent: {
    reason: '@stylistic/indent handles JSX (it replaces the deprecated jsx-indent), so don\'t ignore JSX nodes',
    adapt: ([severity, size, options]) => {
      const { ignoredNodes } = asObject(options);
      return [severity, size, { ...asObject(options), ignoredNodes: toArray(ignoredNodes ?? []).filter((node) => typeof node === 'string' && !node.startsWith('JSX')) }];
    },
  },
  'object-property-newline': {
    reason: '@stylistic removed the deprecated allowMultiplePropertiesPerLine alias (false, i.e. not set)',
    adapt: ([severity, options]) => [severity, omit(options, ['allowMultiplePropertiesPerLine'])],
  },
  'import/no-cycle': {
    reason: 'oxlint wants maxDepth as a number (unlimited is the default anyway) and has no disableScc (a perf option). eslint-plugin-import always ignores type imports',
    adapt: ([severity, options]) => [severity, { ...omit(options, ['maxDepth', 'disableScc']), ignoreTypes: true }],
  },
};

// ESLint plugin name -> oxlint native plugin name (oxlint folds react-hooks into react)
const nativePlugins: Record<string, string> = { '': '', '@typescript-eslint': 'typescript', react: 'react', 'react-hooks': 'react', import: 'import', unicorn: 'unicorn', 'jsx-a11y': 'jsx-a11y' };

// ESLint plugin name -> alias of the same (or forked) ESLint plugin loaded as an oxlint JS plugin (native plugin names are reserved).
// import-js is eslint-plugin-import-x (the maintained fork of eslint-plugin-import)
const jsPluginAliases: Record<string, string> = { '': 'eslint-js', import: 'import-js', unicorn: 'unicorn-js' };

const splitRuleName = (name: string): [string, string] => {
  const i = name.lastIndexOf('/');
  return i === -1 ? ['', name] : [name.slice(0, i), name.slice(i + 1)];
};

export const extensions = ['js', 'cjs', 'mjs', 'jsx', 'ts', 'tsx', 'mts', 'cts'];

const legacyDir = new URL('../legacy/', import.meta.url);

const severities: Record<string, Severity> = { 0: 'off', 1: 'warn', 2: 'error' };

const legacyConfigs = new Map<string, LegacyConfig>();

function loadLegacyConfig(ext: string): LegacyConfig {
  const config = parseJson<{ rules: Record<string, unknown>, settings: LegacyConfig['settings'] }>(execFileSync('node_modules/.bin/eslint', ['--no-eslintrc', '-c', 'eslintrc.cjs', '--print-config', `file.${ext}`], { cwd: legacyDir, encoding: 'utf8' }));
  const rules: Record<string, RuleValue> = {};
  for (const [name, value] of Object.entries(config.rules)) {
    const [severity, ...options] = toArray(value);
    const normalized = severities[String(severity)] ?? severity;
    if (normalized === 'warn' || normalized === 'error') rules[name] = [normalized, ...options];
  }
  return { ...config, rules };
}

// Effective config of the legacy ESLint config for a file with the given extension, with only enabled rules (normalized to [severity, ...options])
export function getLegacyConfig(ext: string) {
  let config = legacyConfigs.get(ext);
  if (!config) {
    config = loadLegacyConfig(ext);
    legacyConfigs.set(ext, config);
  }
  return config;
}

export function getNativeRules() {
  // with an empty config, so that it doesn't depend on (or fail because of) our own config
  const dir = mkdtempSync(`${tmpdir()}/oxlint-`);
  const emptyConfig = join(dir, '.oxlintrc.json');
  writeFileSync(emptyConfig, '{}');
  const rules = parseJson<{ scope: string, value: string }[]>(execFileSync(oxlintBin, ['-c', emptyConfig, '--rules', '--format=json'], { encoding: 'utf8' }));
  rmSync(dir, { recursive: true });
  return new Set(rules.map(({ scope, value }) => (scope === 'eslint' ? value : `${scope.replaceAll('_', '-')}/${value}`)));
}

// @stylistic renamed some of ESLint's core formatting rules
const stylisticRules = new Set(Object.keys(stylistic.rules));
const requireLegacy = (id: string): unknown => createRequire(legacyDir)(id);
const legacyRules = (pluginName: string) => {
  const plugin = asObject(requireLegacy(pluginName));
  return new Map(Object.entries(asObject(plugin.rules)));
};
const ruleMetas: Record<string, ReadonlyMap<string, unknown>> = {
  // eslint-disable-next-line typescript/no-deprecated -- ESLint has no other API that lists its core rules
  '': builtinRules,
  react: legacyRules('eslint-plugin-react'),
  import: legacyRules('eslint-plugin-import'),
  unicorn: new Map(Object.entries(unicorn.rules ?? {})),
};

function toOxlintRuleName(eslintName: string, nativeRules: Set<string>) {
  const [plugin, rule] = splitRuleName(eslintName);

  const nativePlugin = nativePlugins[plugin];
  if (nativePlugin != null) {
    const native = nativePlugin ? `${nativePlugin}/${rule}` : rule;
    if (nativeRules.has(native)) return native;
  }
  // TS versions of core rules are covered by oxlint's (TS-aware) core rules
  if (plugin === '@typescript-eslint' && nativeRules.has(rule)) return rule;
  // ESLint's deprecated Node.js core rules live in oxlint's node plugin
  if (plugin === '' && nativeRules.has(`node/${rule}`)) return `node/${rule}`;

  // ESLint's deprecated core formatting rules and eslint-plugin-react's formatting rules moved to @stylistic
  const stylisticRule = stylisticRenames[rule] ?? rule;
  if (['', 'react'].includes(plugin) && stylisticRules.has(stylisticRule)) return `@stylistic/${stylisticRule}`;

  const alias = jsPluginAliases[plugin];
  if (alias != null) return `${alias}/${rule}`;
  throw new Error(`No oxlint equivalent for ${eslintName}`);
}


// Rules that moved to @stylistic (or are of the layout type), but are about more than formatting
const notFormatting = new Set([
  'no-mixed-operators', // prevents precedence mistakes, like `a && b || c`
  'react/jsx-pascal-case', // naming
  'unicorn/switch-case-braces', // code structure
]);

// Formatting rules that aren't of the layout type
const formatting = new Set(['unicorn/template-indent']);

// Only formatting rules (the ones that moved to @stylistic, or of the layout type) are warnings, so that they stand out from real problems
function isFormatting(eslintName: string) {
  if (notFormatting.has(eslintName)) return false;
  if (formatting.has(eslintName)) return true;
  const [plugin, rule] = splitRuleName(eslintName);
  return (['', 'react'].includes(plugin) && stylisticRules.has(rule)) || asObject(asObject(ruleMetas[plugin]?.get(rule)).meta).type === 'layout';
}

// Rules that stay warnings like in the legacy config, because they don't point at bugs:
// leftover debug logging, anonymous functions (nicer stack traces), and code that the React Compiler skips (informational)
const keptWarnings = new Set(['no-console', 'func-names', 'react-hooks/incompatible-library', 'react-hooks/unsupported-syntax']);

// Returns the expected oxlint [name, [severity, ...options]] for a legacy ESLint rule, or undefined if dropped
export function toOxlintRule(eslintName: string, [, ...options]: RuleValue, nativeRules: Set<string>): [string, RuleValue] | undefined {
  if (Object.hasOwn(dropped, eslintName)) return undefined;
  const replacement = replaced[eslintName];
  if (replacement) return [replacement.by, ['error']];
  const value: RuleValue = [isFormatting(eslintName) || keptWarnings.has(eslintName) ? 'warn' : 'error', ...options];
  return [toOxlintRuleName(eslintName, nativeRules), adaptedOptions[eslintName]?.adapt(value) ?? value];
}
