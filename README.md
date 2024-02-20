# eslint-config-mifi

## Installing

1. Install the correct versions of each package, which are listed by the command:

  ```sh
  npx install-peerdeps --dev eslint-config-mifi
  ```

  If using **yarn**, you can also use the shortcut described above if you have npm 5+ installed on your machine, as the command will detect that you are using yarn and will act accordingly.

2. `npm install --save-dev eslint-config-mifi` or `yarn add -D eslint-config-mifi`

See also [eslint-config-airbnb](https://www.npmjs.com/package/eslint-config-airbnb)

## Using

```js
// .eslintrc.js

module.exports = {
  extends: ['mifi'],

  overrides: [
    // In react/web code
    {
      files: ['./src/**/*.{js,mjs,cjs,jsx,ts,mts,tsx}'],
      env: {
        node: false,
        browser: true,
      },
    },

    // In electron renderer, dependencies should be devDependencies (to prevent them from being included in the Electron ASAR package)
    {
      files: ['./src/{renderer,preload}/**/*.{js,mjs,cjs,jsx,ts,mts,tsx}'],
      env: {
        node: false,
        browser: true,
      },
      globals: {
        electron: true,
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
