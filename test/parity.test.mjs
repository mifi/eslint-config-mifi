import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { matchesGlob } from 'node:path';
import { test } from 'node:test';

import { added, dropped, extensions, getLegacyConfig, getNativeRules, oxlintBin, toOxlintRule } from './mapping.mjs';

const configPath = new URL('../oxlintrc.json', import.meta.url).pathname;
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const nativeRules = getNativeRules();

const normalize = (value) => (Array.isArray(value) ? value : [value]);

// Our own (simplified) resolution of oxlintrc.json for a file, because `oxlint --print-config` omits JS plugin rules
function getOxlintRules(file) {
  const merged = { ...config.rules };
  for (const override of config.overrides ?? []) {
    if (override.files.some((glob) => matchesGlob(file, glob))) Object.assign(merged, override.rules ?? {});
  }
  return Object.fromEntries(Object.entries(merged).map(([name, value]) => [name, normalize(value)]).filter(([, [severity]]) => severity !== 'off'));
}

test('oxlint accepts the config (rule names and options are validated)', () => {
  execFileSync(oxlintBin, ['-c', configPath, 'test-fixtures'], { cwd: new URL('..', import.meta.url), stdio: 'pipe' });
});

for (const ext of extensions) {
  test(`every legacy rule is carried over with the same severity and options (.${ext})`, () => {
    const legacy = getLegacyConfig(ext).rules;
    const actual = getOxlintRules(`src/file.${ext}`);

    const expected = Object.fromEntries(Object.entries(legacy).flatMap(([name, value]) => {
      const rule = toOxlintRule(name, value, nativeRules);
      return rule ? [rule] : [];
    }));

    const extra = Object.fromEntries(Object.entries(actual).filter(([name]) => !(name in expected)));
    assert.deepEqual(Object.keys(extra).toSorted(), Object.keys(added).toSorted(), 'rules that are not in the legacy config must be listed in `added`');
    assert.deepEqual(Object.fromEntries(Object.entries(actual).filter(([name]) => name in expected)), expected);
  });
}

test('dropped rules exist in the legacy config', () => {
  const legacy = new Set(extensions.flatMap((ext) => Object.keys(getLegacyConfig(ext).rules)));
  for (const name of Object.keys(dropped)) assert.ok(legacy.has(name), `${name} is no longer in the legacy config`);
});

test('JS plugins get the legacy settings', async () => {
  // import/parsers and import/ignore are only used by the rules that parse other modules, which we dropped
  const importSettings = Object.fromEntries(Object.entries(getLegacyConfig('ts').settings).filter(([key]) => key.startsWith('import/') && !['import/parsers', 'import/ignore'].includes(key)));
  assert.deepEqual((await import('../plugins/import.js')).default.defaultSettings, importSettings);
});
