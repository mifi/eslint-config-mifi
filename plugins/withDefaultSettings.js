// oxlint doesn't pass `settings` from extended configs to the rules, so a consumer's config that extends ours would lose them.
// Instead we give each rule a context with our settings as defaults (merged per setting, like ESLint does)

/** @typedef {Record<string, unknown>} Settings */

/** @type {(value: unknown) => value is Settings} */
const isObject = (value) => value != null && typeof value === 'object' && !Array.isArray(value);

/** @type {(defaults: Settings, settings: Settings) => Settings} */
const mergeSettings = (defaults, settings) => ({
  ...defaults,
  ...Object.fromEntries(Object.entries(settings).map(([key, value]) => {
    const defaultValue = defaults[key];
    return [key, isObject(value) && isObject(defaultValue) ? { ...defaultValue, ...value } : value];
  })),
});

/**
 * @template {Settings} S
 * @param {{ rules: Record<string, import('eslint').Rule.RuleModule> }} plugin
 * @param {S} defaultSettings
 */
export default function withDefaultSettings(plugin, defaultSettings) {
  // cached per settings object (oxlint creates one per file), so that the rules of a file share it: import-x caches its resolver on its identity
  /** @type {WeakMap<Settings, Settings>} */
  const mergedSettings = new WeakMap();

  /** @param {import('eslint').Rule.RuleContext} context */
  const wrapContext = (context) => {
    let settings = mergedSettings.get(context.settings);
    if (settings == null) {
      settings = mergeSettings(defaultSettings, context.settings);
      mergedSettings.set(context.settings, settings);
    }
    return new Proxy(context, {
      get: (target, prop) => {
        if (prop === 'settings') return settings;
        /** @type {unknown} */
        const value = Reflect.get(target, prop);
        return value;
      },
    });
  };

  return {
    ...plugin,
    defaultSettings,
    rules: Object.fromEntries(Object.entries(plugin.rules).map(([name, rule]) => [name, { ...rule, create: (/** @type {import('eslint').Rule.RuleContext} */ context) => rule.create(wrapContext(context)) }])),
  };
}
