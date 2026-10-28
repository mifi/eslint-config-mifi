import assert from 'node:assert/strict';
import { test } from 'node:test';

import config from '../oxlintrc.json' with { type: 'json' };
import migrateSource, { replacedRules, successorRules } from '../migrateSource.mjs';
import { dropped, replaced } from './mapping.ts';

test('renames rules in eslint directive comments', () => {
  assert.equal(migrateSource([
    '// eslint-disable-next-line import/no-extraneous-dependencies',
    '/* eslint-disable quote-props */',
    '// eslint-disable-next-line wrap-iife, func-names -- reason with prefer-switch',
    '// eslint-disable-line react/jsx-tag-spacing, @typescript-eslint/no-explicit-any',
    "const a = 'eslint-disable quote-props'; // eslint-disable-line unicorn/prefer-switch",
  ].join('\n')), [
    '// eslint-disable-next-line import-js/no-extraneous-dependencies',
    '/* eslint-disable @stylistic/quote-props */',
    '// eslint-disable-next-line @stylistic/wrap-iife, func-names -- reason with prefer-switch',
    '// eslint-disable-line @stylistic/jsx-tag-spacing, @typescript-eslint/no-explicit-any',
    "const a = 'eslint-disable quote-props'; // eslint-disable-line unicorn-js/prefer-switch",
  ].join('\n'));
});

test('renames replaced rules', () => {
  assert.deepEqual(replacedRules, Object.fromEntries(Object.entries(replaced).map(([name, { by }]) => [name, by])));
  assert.equal(migrateSource('// eslint-disable-next-line no-new-object'), '// eslint-disable-next-line no-object-constructor');
});

test('renames all rules in multi-line block directives', () => {
  assert.equal(migrateSource('/* eslint-disable\n  quotes,\n  indent\n*/'), '/* eslint-disable\n  @stylistic/quotes,\n  @stylistic/indent\n*/');
});

test('leaves code after a directive without rules alone', () => {
  const source = '// eslint-disable-next-line\nconst { indent } = opts;';
  assert.equal(migrateSource(source), source);
});

test('renames dropped rules to their successor in our config', () => {
  for (const [name, successor] of Object.entries(successorRules)) {
    assert.ok(Object.hasOwn(dropped, name), name);
    assert.ok(Object.hasOwn(config.rules, successor), successor);
  }
  assert.equal(migrateSource('// eslint-disable-next-line unicorn/no-array-push-push'), '// eslint-disable-next-line unicorn/prefer-single-call');
});
