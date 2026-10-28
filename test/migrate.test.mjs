import assert from 'node:assert/strict';
import { test } from 'node:test';

import migrateSource, { replacedRules } from '../migrateSource.mjs';
import { replaced } from './mapping.mjs';

test('renames rules in eslint directive comments', () => {
  assert.equal(migrateSource([
    '// eslint-disable-next-line import/no-extraneous-dependencies',
    '/* eslint-disable quote-props */',
    '// eslint-disable-next-line wrap-iife, func-names -- reason with prefer-switch',
    '// eslint-disable-line react/destructuring-assignment, @typescript-eslint/no-explicit-any',
    "const a = 'eslint-disable quote-props'; // eslint-disable-line unicorn/prefer-switch",
  ].join('\n')), [
    '// eslint-disable-next-line import-js/no-extraneous-dependencies',
    '/* eslint-disable eslint-js/quote-props */',
    '// eslint-disable-next-line eslint-js/wrap-iife, func-names -- reason with prefer-switch',
    '// eslint-disable-line react-js/destructuring-assignment, @typescript-eslint/no-explicit-any',
    "const a = 'eslint-disable quote-props'; // eslint-disable-line unicorn-js/prefer-switch",
  ].join('\n'));
});

test('renames replaced rules', () => {
  assert.deepEqual(replacedRules, Object.fromEntries(Object.entries(replaced).map(([name, { by }]) => [name, by])));
  assert.equal(migrateSource('// eslint-disable-next-line no-new-object'), '// eslint-disable-next-line no-object-constructor');
});

test('renames all rules in multi-line block directives', () => {
  assert.equal(migrateSource('/* eslint-disable\n  quotes,\n  indent\n*/'), '/* eslint-disable\n  eslint-js/quotes,\n  eslint-js/indent\n*/');
});

test('leaves code after a directive without rules alone', () => {
  const source = '// eslint-disable-next-line\nconst { indent } = opts;';
  assert.equal(migrateSource(source), source);
});
