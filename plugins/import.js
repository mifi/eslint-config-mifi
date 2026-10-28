import plugin from 'eslint-plugin-import-x';

import withDefaultSettings from './withDefaultSettings.js';

export default withDefaultSettings(plugin, {
  'import-x/resolver': {
    node: { extensions: ['.mjs', '.cjs', '.js', '.json', '.ts', '.tsx', '.mts', '.cts', '.jsx'] },
  },
  'import-x/extensions': ['.ts', '.cts', '.mts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
  'import-x/external-module-folders': ['node_modules', 'node_modules/@types'],
  'import-x/core-modules': [],
});
