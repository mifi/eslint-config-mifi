import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { matchesGlob } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import importPlugin from '../plugins/import.js';
import { added, dropped, extensions, getLegacyConfig, getNativeRules, oxlintBin, parseJson, toOxlintRule } from './mapping.ts';
import type { RuleValue } from './mapping.ts';

const configPath = fileURLToPath(new URL('../oxlintrc.json', import.meta.url));
type RuleSetting = RuleValue[0] | RuleValue;
const config = parseJson<{ rules: Record<string, RuleSetting>, overrides?: { files: string[], rules?: Record<string, RuleSetting> }[] }>(readFileSync(configPath, 'utf8'));
const nativeRules = getNativeRules();

const normalize = (value: RuleSetting): RuleValue => (Array.isArray(value) ? value : [value]);

// Our own (simplified) resolution of oxlintrc.json for a file, because `oxlint --print-config` omits JS plugin rules
function getOxlintRules(file: string) {
  const merged = { ...config.rules };
  const overrides = config.overrides ?? [];
  for (const override of overrides) {
    if (override.files.some((glob) => matchesGlob(file, glob))) Object.assign(merged, override.rules ?? {});
  }
  return Object.fromEntries(Object.entries(merged).map(([name, value]): [string, RuleValue] => [name, normalize(value)]).filter(([, [severity]]) => severity !== 'off'));
}

test('oxlint accepts the config (rule names and options are validated)', () => {
  execFileSync(oxlintBin, ['-c', configPath, 'test-fixtures'], { cwd: new URL('..', import.meta.url), stdio: 'pipe' });
});

for (const ext of extensions) {
  test(`every legacy rule is carried over with the same options (warnings only for formatting and a few informational rules) (.${ext})`, () => {
    const legacy = getLegacyConfig(ext).rules;
    const actual = getOxlintRules(`src/file.${ext}`);

    const expected = Object.fromEntries(Object.entries(legacy).flatMap(([name, value]) => {
      const rule = toOxlintRule(name, value, nativeRules);
      return rule ? [rule] : [];
    }));

    const extra = Object.fromEntries(Object.entries(actual).filter(([name]) => !Object.hasOwn(expected, name)));
    assert.deepEqual(Object.keys(extra).toSorted((a, b) => a.localeCompare(b)), Object.keys(added).toSorted((a, b) => a.localeCompare(b)), 'rules that are not in the legacy config must be listed in `added`');
    assert.deepEqual(Object.fromEntries(Object.entries(actual).filter(([name]) => Object.hasOwn(expected, name))), expected);
  });
}

test('dropped rules exist in the legacy config', () => {
  const legacy = new Set(extensions.flatMap((ext) => Object.keys(getLegacyConfig(ext).rules)));
  for (const name of Object.keys(dropped)) assert.ok(legacy.has(name), `${name} is no longer in the legacy config`);
});

test('JS plugins get the legacy settings', () => {
  // import/parsers and import/ignore are only used by the rules that parse other modules, which we dropped
  const { 'import/resolver': legacyResolver, ...legacySettings } = getLegacyConfig('ts').settings;
  // eslint-plugin-import-x reads its settings from import-x/* instead of import/*
  const { 'import-x/resolver': resolver, ...settings } = importPlugin.defaultSettings;
  assert.deepEqual(
    Object.fromEntries(Object.entries(settings).map(([key, value]) => [key.replace(/^import-x\//, 'import/'), value])),
    Object.fromEntries(Object.entries(legacySettings).filter(([key]) => key.startsWith('import/') && !['import/parsers', 'import/ignore'].includes(key))),
  );
  // the legacy resolver extensions lacked .tsx, .mts and .cts (and had duplicates)
  for (const ext of legacyResolver.node.extensions) assert.ok(resolver.node.extensions.includes(ext), ext);
});
