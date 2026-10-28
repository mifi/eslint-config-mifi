// Exposes ESLint's core rules, so that the ones oxlint doesn't implement natively can be used as an oxlint JS plugin
import { builtinRules } from 'eslint/use-at-your-own-risk';

export default {
  meta: { name: 'eslint' },
  rules: Object.fromEntries(builtinRules),
};
