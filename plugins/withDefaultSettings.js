// oxlint doesn't pass `settings` from extended configs to the rules, so a consumer's config that extends ours would lose them.
// Instead we give each rule a context with our settings as defaults.
export default function withDefaultSettings(plugin, defaultSettings) {
  const wrapContext = (context) => new Proxy(context, {
    get: (target, prop) => (prop === 'settings' ? { ...defaultSettings, ...target.settings } : Reflect.get(target, prop)),
  });

  return {
    ...plugin,
    defaultSettings,
    rules: Object.fromEntries(Object.entries(plugin.rules).map(([name, rule]) => [name, { ...rule, create: (context) => rule.create(wrapContext(context)) }])),
  };
}
