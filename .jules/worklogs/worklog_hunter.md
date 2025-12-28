# Hunter's Journal

## 2024-05-22 - [Journal Init] **Learning:** Initialized Hunter's journal. **Action:** Record critical learnings here.

## 2024-05-24 - [Commands Missing Context] **Learning:** The `BaseEffectCommand` constructor requires a `CommandContext` object, but many existing tests (and potentially legacy code) only pass partial data or stubbed objects, leading to `TypeError: Cannot read properties of undefined` when new features try to access properties like `caster.id` deeply. **Action:** When testing commands, ensure the `CommandContext` is robustly mocked using factories or explicit object literals that match the interface, rather than relying on `any` casts.

## 2024-05-24 - [Logic Simplification] **Learning:** Reviewers prefer direct comparisons (e.g., `newVal > oldVal`) over calculating intermediate deltas (`diff = newVal - oldVal; if diff > 0`) when the delta value itself isn't used elsewhere. **Action:** Keep logic blocks concise and avoid creating variables that are only used once for a condition check.

## 2024-05-24 - [Duplicate PR Comments] **Learning:** Automated code review bots may re-post comments on new commits if they perceive the issue as unresolved, or simply as a summary. **Action:** Always double-check the code state against the comment before assuming work is needed; if the work is done, simply acknowledge the comment.

## 2024-05-24 - [Refactoring Visual Logic] **Learning:** Using inline 'onError' handlers that manually append DOM nodes is a React anti-pattern that bypasses the virtual DOM. **Action:** Always wrap such logic in a dedicated sub-component that manages the error state (e.g., 'imageError') via 'useState', ensuring the UI updates predictably within the React lifecycle.

## 2024-05-25 - [Type-Safe Test Mocks] **Learning:** Tests relying on `any` casts to bypass type checks (e.g., `class: 'Wizard' as any`) obscure interface mismatches and accumulate technical debt. **Action:** Use shared factory functions (like `createMockCombatState` or `createMockCombatCharacter`) or define minimal compliant objects (like `mockWizardClass`) within the test file to enforce type safety without creating comprehensive manual mocks.
