// oxlint doesn't pass `settings` from extended configs to the rules, so a consumer's config that extends ours would lose them.
// Instead we give each rule a context with our settings as defaults (merged per setting, like ESLint does)
const isObject = (value) => value != null && typeof value === 'object' && !Array.isArray(value);

const mergeSettings = (defaults, settings) => ({
  ...defaults,
  ...Object.fromEntries(Object.entries(settings).map(([key, value]) => [key, isObject(value) && isObject(defaults[key]) ? { ...defaults[key], ...value } : value])),
});

export default function withDefaultSettings(plugin, defaultSettings) {
  const wrapContext = (context) => {
    const settings = mergeSettings(defaultSettings, context.settings);
    return new Proxy(context, { get: (target, prop) => (prop === 'settings' ? settings : Reflect.get(target, prop)) });
  };

  return {
    ...plugin,
    defaultSettings,
    rules: Object.fromEntries(Object.entries(plugin.rules).map(([name, rule]) => [name, { ...rule, create: (context) => rule.create(wrapContext(context)) }])),
  };
}
