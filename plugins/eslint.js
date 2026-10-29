// Exposes the ESLint core rules that oxlint doesn't implement natively, as an oxlint JS plugin. Only the ones we use, because loading all of them takes ~0.7 s
import { builtinRules } from 'eslint/use-at-your-own-risk';

const ruleNames = ['camelcase', 'no-restricted-syntax', 'no-undef-init'];

export default {
  meta: { name: 'eslint' },
  // eslint-disable-next-line typescript/no-deprecated -- ESLint has no other API that exposes its core rules
  rules: Object.fromEntries(ruleNames.map((name) => [name, builtinRules.get(name)])),
};
