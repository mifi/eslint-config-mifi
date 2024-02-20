module.exports = {
  extends: [
    'airbnb',
    'airbnb/hooks', // airbnb first because some rules will be disabled by the other plugins
    'eslint:recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:@typescript-eslint/strict',
    'plugin:@typescript-eslint/stylistic',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:unicorn/recommended',
  ],
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
    'unicorn',
    'react',
  ],
  env: {
    es2022: true,
    node: true, // nice default, butit  should be disabled for web code in consuming projects

    // unset what airbnb sets:
    es6: false,
  },
  settings: {
    react: {
      // version: 'detect',
    },
    'import/resolver': {
      node: { extensions: ['.mjs', '.cjs', '.js', '.json', '.ts'] },
    },
  },
  rules: {
    // based on airbnb
    'no-restricted-syntax': [
      'error',
      {
        selector: 'ForInStatement',
        message: 'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.',
      },
      {
        selector: 'LabeledStatement',
        message: 'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
      },
      {
        selector: 'WithStatement',
        message: '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
      },
    ],

    'react/jsx-filename-extension': ['error', { extensions: ['.jsx', '.tsx'] }],

    // todo https://github.com/iamturns/eslint-config-airbnb-typescript/blob/8ef77c928c97d977f053c9c638831363a715d4a9/lib/shared.js#L31

    // todo https://github.com/eslint-community/eslint-plugin-n

    'no-multiple-empty-lines': ['error', { max: 2, maxBOF: 0, maxEOF: 0 }],

    // handled by TS
    'import/no-unresolved': 0, // https://github.com/iamturns/eslint-config-airbnb-typescript/tree/master?tab=readme-ov-file#why-is-importno-unresolved-disabled

    // conflicts with TS:
    'import/extensions': 0, // doesn't work with TS https://github.com/import-js/eslint-plugin-import/issues/2111
    'dot-notation': 0,

    'no-spaced-func': 0, // https://github.com/iamturns/eslint-config-airbnb-typescript/issues/246
    'func-call-spacing': 0,
    '@typescript-eslint/func-call-spacing': ['error', 'never'],

    // Don't agree
    'max-len': 0,
    '@typescript-eslint/no-non-null-assertion': 0,
    'default-case': 0,
    'object-curly-newline': 0,
    'max-classes-per-file': 0,
    'react/require-default-props': 0,
    'no-await-in-loop': 0,
    'react/prop-types': 0,
    'react/sort-comp': 0,
    'react/jsx-one-expression-per-line': 0,
    'react/function-component-definition': 0,
    'no-promise-executor-return': 0,

    // conflicts with TS
    'unicorn/prefer-module': 0,
    'unicorn/no-useless-undefined': 0,

    // disable unwanted rules
    'unicorn/no-anonymous-default-export': 0,
    'unicorn/no-negated-condition': 0,
    'unicorn/prevent-abbreviations': 0,
    'unicorn/no-array-for-each': 0,
    'unicorn/no-null': 0,
    'unicorn/prefer-number-properties': 0,
    'unicorn/import-style': 0,
    'unicorn/numeric-separators-style': 0,
    'unicorn/catch-error-name': 0,
    'unicorn/consistent-function-scoping': 0,
    'unicorn/no-await-expression-member': 0,
    'unicorn/error-message': 0, // i'm lazy
    'unicorn/prefer-query-selector': 0,

    // extra wanted rules in addition to "recommended"
    'unicorn/custom-error-definition': 'error',
    'react-hooks/exhaustive-deps': 'error',

    'unicorn/filename-case': ['error', { cases: { camelCase: true, pascalCase: true } }],
  },
};
