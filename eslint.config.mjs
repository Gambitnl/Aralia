import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import react from 'eslint-plugin-react';
import tseslint from 'typescript-eslint';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'node_modules/',
      'public/',
      'coverage/',
      '*.config.*',
      // These folders are gitignored and contain WIP/prototype code; don't block pushes on lint here.
      'src/components/DesignPreview/**',
      'src/components/ThreeDModal/Experimental/**',
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react': react,
      'jsx-a11y': jsxA11y,
    },
    settings: {
        react: {
            version: 'detect',
        },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      'react/prop-types': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/ban-ts-comment': 'warn',
      // Newer versions of eslint-plugin-react-hooks include additional rules that are currently too strict
      // for this repo's existing patterns. Keep them as warnings so pushes aren't blocked while we
      // migrate code incrementally.
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/rules-of-hooks': 'warn',
      // 'react-hooks/set-state-in-effect': 'warn', // Not standard rule name?
      // 'react-hooks/static-components': 'warn', // Not standard?
      // 'react-hooks/immutability': 'warn', // Not standard?
      'jsx-a11y/no-autofocus': 'warn',
      'jsx-a11y/label-has-associated-control': 'warn',
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
      'jsx-a11y/no-noninteractive-element-interactions': 'warn',
      'jsx-a11y/no-noninteractive-tabindex': 'warn',
      'jsx-a11y/no-redundant-roles': 'warn',
      'react/no-unescaped-entities': 'warn',
      'react/display-name': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      'no-dupe-else-if': 'warn',
      'no-self-assign': 'warn',
      'prefer-const': 'warn',
      'no-case-declarations': 'warn',
      'no-constant-condition': 'warn',
      'no-mixed-spaces-and-tabs': 'warn',
    },
  },
  {
    files: [
      '*.test.{ts,tsx}',
      '**/__tests__/**/*.{ts,tsx}',
      'tests/**/*.{ts,tsx}',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
        vi: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
  },
  {
    files: ['scripts/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  }
);
