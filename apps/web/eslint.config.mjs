// ESLint flat config — KHONG dung eslint-config-next vi no keo
// @rushstack/eslint-patch loi voi ESLint 9.28+ (xem bao cao Module 1).
// Dung @eslint/js + typescript-eslint + react-hooks; se xem xet lai
// khi eslint-config-next sua tuong thich.
import js from '@eslint/js';
import ts from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    ignores: ['node_modules/', '.next/', '.vercel/', 'out/', 'dist/'],
  },
);
