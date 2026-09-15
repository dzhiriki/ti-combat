/** @type {import('stylelint').Config} */
export default {
  ignoreFiles: ['.worktrees/**'],
  plugins: ['stylelint-order'],
  extends: ['stylelint-config-standard'],
  rules: {
    // Tailwind directives
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: ['layer', 'config', 'theme', 'reference'],
      },
    ],
    'function-no-unknown': [
      true,
      {
        ignoreFunctions: ['theme'],
      },
    ],

    // CSS Modules support
    'selector-class-pattern': null,
    'keyframes-name-pattern': null,
    'selector-pseudo-class-no-unknown': [
      true,
      {
        ignorePseudoClasses: ['global'],
      },
    ],

    // Formatting handled by Oxfmt
    'declaration-empty-line-before': null,
    'rule-empty-line-before': null,

    // Allow legacy color notation (auto-fixable)
    'color-function-notation': 'modern',
    'alpha-value-notation': 'percentage',
    'hue-degree-notation': 'angle',

    // Other
    'import-notation': null,
    'no-descending-specificity': null,

    'order/order': ['custom-properties', 'declarations', 'at-rules'],
  },
}
