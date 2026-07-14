import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'uploads/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Кодовая база широко использует any на границах (Prisma Json, Fastify
      // req/res, внешние API) — запрет включим после типизации этих мест.
      '@typescript-eslint/no-explicit-any': 'off',
      // main.ts регистрирует fastify-плагины через require().
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
);
