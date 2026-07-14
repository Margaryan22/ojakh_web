import { defineConfig, globalIgnores } from 'eslint/config';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

export default defineConfig([
  globalIgnores([
    '.next/**',
    'node_modules/**',
    'next-env.d.ts',
    'public/sw.js',
  ]),
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Разрешаем неиспользуемые аргументы/переменные с префиксом _
      // (например, деструктуризация `const { password, ..._rest }`).
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
]);
