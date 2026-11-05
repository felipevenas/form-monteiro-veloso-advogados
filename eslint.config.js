import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules', 'supabase', 'coverage'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*', '@/app/*'],
              message: 'shared não pode importar features nem app.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/features/*/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'react-router-dom', '@tanstack/*', '@supabase/*'],
              message: 'domain é TypeScript puro.',
            },
            {
              group: ['@/shared/ui/*', '@/features/*/ui/*', '@/features/*/infrastructure/*'],
              message: 'domain não importa UI nem infraestrutura.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/features/*/application/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/shared/ui/*', '@/features/*/ui/*'],
              message: 'application não importa UI.',
            },
          ],
        },
      ],
    },
  },
)
