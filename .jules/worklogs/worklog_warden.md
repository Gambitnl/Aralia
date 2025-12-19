# Warden's Worklog

This journal tracks CRITICAL error handling learnings, patterns, and strategies.

## Format
`## YYYY-MM-DD - [Title]`
**Learning:** [Insight]
**Action:** [How to apply next time]

## 2024-05-23 - Fortifying AI Client Initialization
**Learning:** Modules exporting singletons based on environment variables (like `aiClient.ts`) can cause "Cannot read properties of null" crashes if consumers import them before the environment is ready or if the variable is missing. Direct null checks at import time are insufficient if the consumer accesses the export blindly.
**Action:** Wrap potentially uninitialized singletons in a JavaScript `Proxy`. The Proxy intercepts all property access and throws a clear, descriptive error (e.g., "AI client not initialized") instead of a generic runtime crash. This allows existing `try-catch` blocks in consumer code to handle the failure gracefully.

## 2024-05-23 - Testing Environment-Dependent Modules
**Learning:** Testing modules that rely on `src/config/env.ts` constants is tricky because standard `vi.mock` hoisting or module caching can persist state between tests.
**Action:** Use `vi.doMock` with the *correct relative path* from the test file (e.g., `../../config/env`) inside `it` blocks, combined with dynamic `await import()` of the module under test. This forces a fresh evaluation of the module with the specific mocked environment for that test case.

## 2024-05-23 - LocalStorage Quota Handling
**Learning:** `localStorage.setItem` throws a `QuotaExceededError` when storage is full. This crashes the application if unhandled.
**Action:** Always wrap `setItem` calls in a `try-catch` block. If the write fails (especially for metadata or indexes), implement a "graceful degradation" strategy: update the in-memory state or SessionStorage so the user can continue their current session without interruption, even if persistence fails. Log a warning for debugging.
