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
      // C8 (agora-9ed9.8, 2026-10-24): an error, not a warning. @ts-ignore and @ts-nocheck hide every type error on a line or file; @ts-expect-error stays allowed with a reason, since it fails once the error is gone. The only remaining @ts-ignore lines import the untyped vendored ez-tree library and carry their own reasoned disable, so this rule blocks only NEW suppressions.
      '@typescript-eslint/ban-ts-comment': ['error', { 'ts-ignore': true, 'ts-nocheck': true, 'ts-check': false, 'ts-expect-error': 'allow-with-description' }],
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

      // ---------------------------------------------------------------------------
      // Button design-system guard
      // ---------------------------------------------------------------------------
      // Warn whenever a raw <button> or <motion.button> is written directly in JSX.
      // Prefer the shared <Button> component (ui/Button) which encapsulates the
      // BTN_* style constants and adds spring-tap animation:
      //   <Button variant="primary" size="md" onClick={...}>Label</Button>
      //
      // If you genuinely need lower-level control, apply the BTN_* constants:
      //   import { BTN_BASE, BTN_SIZE_MD, BTN_PRIMARY } from '../../styles/buttonStyles';
      //   <button className={`${BTN_BASE} ${BTN_SIZE_MD} ${BTN_PRIMARY}`}>...</button>
      //
      // For intentionally custom interactive controls (resize handles, portrait
      // buttons, etc.) add the file to EXEMPT_FILES in buttonAudit.test.ts and
      // suppress this rule with eslint-disable-next-line for that one element.
      //
      // Set to 'warn' (not 'error') while migrating the 108 existing violations.
      // Once violations reach 0, upgrade to 'error' to prevent regressions.
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'JSXOpeningElement[name.name="button"]',
          message:
            "Raw <button> detected. Prefer <Button variant='...' size='...'> from 'ui/Button', " +
            "or apply BTN_BASE + BTN_* constants from 'styles/buttonStyles'. " +
            "If intentionally custom, add the file to EXEMPT_FILES in buttonAudit.test.ts.",
        },
        {
          selector: 'JSXOpeningElement[name.object.name="motion"][name.property.name="button"]',
          message:
            "Raw <motion.button> detected. Prefer <Button variant='...' size='...'> from 'ui/Button' — " +
            "it already wraps motion.button with a spring-tap animation. " +
            "If intentionally custom, add the file to EXEMPT_FILES in buttonAudit.test.ts.",
        },
        {
          selector:
            'CallExpression[callee.type="MemberExpression"][callee.object.name="crypto"][callee.property.name="randomUUID"]',
          message:
            'Direct crypto.randomUUID() call detected. Use generateId() from src/utils/core/idGenerator.ts ' +
            '(it wraps crypto.randomUUID and falls back where the API is unavailable). ' +
            'idGenerator.ts itself is exempt.',
        },
      ],
    },
  },
  {
    // idGenerator.ts is the single sanctioned caller of crypto.randomUUID().
    // Re-declare the rule here WITHOUT the crypto selector so the two button
    // selectors still apply to this file.
    files: ['src/utils/core/idGenerator.ts'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'JSXOpeningElement[name.name="button"]',
          message:
            "Raw <button> detected. Prefer <Button variant='...' size='...'> from 'ui/Button', " +
            "or apply BTN_BASE + BTN_* constants from 'styles/buttonStyles'. " +
            "If intentionally custom, add the file to EXEMPT_FILES in buttonAudit.test.ts.",
        },
        {
          selector: 'JSXOpeningElement[name.object.name="motion"][name.property.name="button"]',
          message:
            "Raw <motion.button> detected. Prefer <Button variant='...' size='...'> from 'ui/Button' — " +
            "it already wraps motion.button with a spring-tap animation. " +
            "If intentionally custom, add the file to EXEMPT_FILES in buttonAudit.test.ts.",
        },
      ],
    },
  },
  {
    // C11 (agora-9ed9.11, 2026-10-25): layering. Production code in systems/ and
    // utils/ must not import components/ or hooks/; move the shared piece down
    // into systems, utils, or types and re-export it from the old path. Type-only
    // imports count too, since they still tie the lower layer to UI files.
    // Tests are exempt: integration tests cross layers on purpose.
    files: ['src/systems/**/*.{ts,tsx}', 'src/utils/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}', '**/__tests__/**'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          regex: '^(@/|(\\.\\./)+)(components|hooks)/',
          message: 'systems/ and utils/ must not import components/ or hooks/ (C11). Move the shared piece into systems, utils, or types and re-export it from the old path.',
        }],
      }],
    },
  },
  {
    // C11 exception, tracked as GG-438 in docs/projects/GLOBAL_GAPS.md: these four
    // river files import water modules from components/World3D/water. All of them
    // and their targets carry another agent's uncommitted or untracked water work,
    // so the shared pieces move into systems/world3d/river when that work lands.
    // Warn until then; remove each file from this list as it is fixed.
    files: [
      'src/systems/world3d/river/riverMapWorker.ts',
      'src/systems/world3d/river/riverHeadwaters.ts',
      'src/systems/world3d/river/riverReconstructionRock.ts',
      'src/systems/world3d/river/waterfallTerrainComparisons.worker.ts',
    ],
    rules: {
      'no-restricted-imports': ['warn', {
        patterns: [{
          regex: '^(@/|(\\.\\./)+)(components|hooks)/',
          message: 'systems/ and utils/ must not import components/ or hooks/ (C11). Known exception; see GG-438 in GLOBAL_GAPS.md.',
        }],
      }],
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
