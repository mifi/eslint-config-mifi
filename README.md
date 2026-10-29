# @mifi/lint-config

mifi's [oxlint](https://oxc.rs/docs/guide/usage/linter) config, formerly [eslint-config-mifi](https://www.npmjs.com/package/eslint-config-mifi) (ESLint + `eslint-config-airbnb`).

It carries over every rule of the last ESLint-based version (`eslint-config-mifi@0.1.1`), with the same options (but only formatting rules and a few informational ones like `no-console` are warnings now, see below), and adds the current recommended (strict) rules of typescript-eslint, unicorn and @eslint-react. The exceptions (deprecated or JavaScript-only rules, rules of unmaintained plugins) and additions are listed with reasons in [test/mapping.ts](test/mapping.ts). This is verified by the [parity tests](test/parity.test.ts) against a frozen copy of the old config in [legacy/](legacy/).

Most rules run natively in oxlint. The rest run as oxlint [JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html) using ESLint plugins, some aliased because oxlint reserves the native plugin names:

| Prefix | Plugin |
| --- | --- |
| `eslint-js/*` | ESLint's core rules (the few that oxlint doesn't implement: `camelcase`, `no-restricted-syntax`, `no-undef-init`) |
| `import-js/*` | `eslint-plugin-import-x` (the maintained fork of `eslint-plugin-import`) |
| `unicorn-js/*` | `eslint-plugin-unicorn` |
| `@stylistic/*` | `@stylistic/eslint-plugin` (formatting, the successor of ESLint's and eslint-plugin-react's formatting rules) |
| `@eslint-react/*` | `@eslint-react/eslint-plugin` |

Formatting rules (and `no-console`, `func-names` and the React Compiler's informational rules) are warnings, so they stand out from real problems in the editor. Use `--deny-warnings` in CI.

## Installing

```sh
yarn add -D @mifi/lint-config oxlint oxlint-tsgolint
```

`oxlint-tsgolint` is needed for the type-aware rules (`--type-aware`). `typescript` must be installed too (for `@eslint-react`).

## Using

```jsonc
// .oxlintrc.json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "extends": ["./node_modules/@mifi/lint-config/oxlintrc.json"],
  // oxlint doesn't inherit settings from extended configs
  "settings": {
    "react": { "version": "19" }
  },
  "overrides": [
    // In react/web code
    {
      "files": ["src/**"],
      "env": { "node": false, "browser": true }
    },
    // In electron renderer, dependencies should be devDependencies (to prevent them from being included in the Electron ASAR package)
    {
      "files": ["src/{renderer,preload}/**"],
      "env": { "node": false, "browser": true },
      "rules": {
        "import-js/no-extraneous-dependencies": ["error", { "devDependencies": true, "optionalDependencies": false }]
      }
    }
  ]
}
```

```jsonc
// package.json
{
  "scripts": {
    "lint": "oxlint --type-aware --deny-warnings"
  }
}
```

For VS Code, use the [oxc extension](https://marketplace.visualstudio.com/items?itemName=oxc.oxc-vscode) (enable `oxc.typeAware`).

### Too many errors?

When a rule causes a lot of changes in your project, turn it off in your own `.oxlintrc.json` (and fix it later). For example `import/extensions` (explicit `.ts` extensions in relative imports) if your bundler doesn't need them. When it only causes a few, but risky, changes, use disable comments on those lines.

## Migrating from eslint-config-mifi

1. Replace `eslint`, `eslint-config-mifi`, `@typescript-eslint/*` and `eslint-plugin-*` with the packages above.
2. Move your `.eslintrc*` to `.oxlintrc.json` (see above), and `.eslintignore` to `ignorePatterns`. Rename `import/*` settings (e.g. `import/resolver`) to `import-x/*`, which is what eslint-plugin-import-x reads. Note that oxlint doesn't ignore dotfiles (e.g. `.yarn/releases`) like ESLint does.
3. Rename rules in your config that are now JS plugin rules (e.g. `import/no-extraneous-dependencies` -> `import-js/no-extraneous-dependencies`, `indent` -> `@stylistic/indent`, see the table above).
4. Rename them in your `eslint-disable` comments too (oxlint respects `eslint-disable` comments):
   ```sh
   npx mifi-lint-migrate
   ```

## Developing

```sh
yarn install
(cd legacy && yarn install)
yarn test
yarn typecheck
yarn lint
```

The tests are TypeScript. The published files (`plugins/`, `migrate*.mjs`) are JavaScript with JSDoc types (checked by `yarn typecheck`), because Node doesn't strip types in `node_modules`.

## Releasing

```bash
np
```
