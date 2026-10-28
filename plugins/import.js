import plugin from 'eslint-plugin-import';

import withDefaultSettings from './withDefaultSettings.js';

export default withDefaultSettings(plugin, {
  'import/resolver': {
    node: { extensions: ['.mjs', '.cjs', '.js', '.json', '.ts', '.jsx', '.mjs', '.cjs'] },
  },
  'import/extensions': ['.ts', '.cts', '.mts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
  'import/external-module-folders': ['node_modules', 'node_modules/@types'],
  'import/core-modules': [],
});
