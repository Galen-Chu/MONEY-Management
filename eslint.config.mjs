// ESLint(扁平設定)——沿用 TIME-Management 同套規則。
// 核心規則:JSX 內禁止直接書寫 CJK 文字(必須走 i18n key);
// 服務層/網域層字串另由 Jest 掃描測試(no-raw-cjk.test.ts)把關。
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
    plugins: { '@typescript-eslint': tseslint, 'react-hooks': reactHooks },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXText[value=/[\\u4e00-\\u9fff]/]',
          message: 'UI 字串禁止直接書寫中文——必須走 i18n key(t("..."))。',
        },
        {
          selector: "JSXAttribute[name.name='accessibilityLabel'] > Literal[value=/[\\u4e00-\\u9fff]/]",
          message: 'accessibilityLabel 不得寫死中文,請使用 t()。',
        },
      ],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    ignores: ['node_modules/', 'src/i18n/locales/**'],
  },
];
