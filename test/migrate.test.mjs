import assert from 'node:assert/strict';
import { test } from 'node:test';

import migrateSource from '../migrate.mjs';

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
