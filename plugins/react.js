import plugin from 'eslint-plugin-react';

import withDefaultSettings from './withDefaultSettings.js';

export default withDefaultSettings(plugin, {
  react: { version: 'detect' },
});
