# eslint-config-mifi

## Installing

Install the correct versions of each package, which are listed by the command:

```sh
(
  export PKG=eslint-config-mifi;
  npm info "$PKG@latest" peerDependencies --json | command sed 's/[\{\},]//g ; s/: /@/g' | xargs yarn add -D "$PKG"
)
```

See also [eslint-config-airbnb](https://www.npmjs.com/package/eslint-config-airbnb)

## Using

```js
// .eslintrc.js

module.exports = {
  extends: ['mifi'],

  overrides: [
    // In react/web code
    {
      files: ['./src/**/*.{js,mjs,cjs,mjs,jsx,ts,mts,tsx}'],
      env: {
        node: false,
        browser: true,
      },
    },

    // In electron renderer, dependencies should be devDependencies (to prevent them from being included in the Electron ASAR package)
    {
      files: ['./src/{renderer,preload}/**/*.{js,mjs,cjs,mjs,jsx,ts,mts,tsx}'],
      env: {
        node: false,
        browser: true,
      },
      rules: {
        'import/no-extraneous-dependencies': ['error', {
          devDependencies: true,
          optionalDependencies: false,
        }],
      },
    },
  ],
}
```

## List effective rules

```bash
npx eslint --print-config test-fixtures/React.tsx
```

## Releasing

- `npm i -g np`
- `np`
