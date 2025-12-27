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

## 2024-05-24 - Data Factory Reliability
**Learning:** Factory functions (like `createAbilityFromSpell`) that transform raw JSON data into runtime objects are a major source of silent "poisoned data" failures. Simple type checking isn't enough because JSON loaded at runtime can be malformed (e.g., `effects: {}` instead of `[]`) or missing expected keys. This leads to `NaN` propagating through the system (e.g., infinite damage or healing) rather than a clear error.
**Action:** Implement defensive checks at the factory level.
1.  Verify array integrity (`Array.isArray()`) before iterating, even if TypeScript types say it's an array.
2.  Use explicit fallbacks for critical calculations (e.g., `spellcastingStat` lookup) to prevent `undefined` -> `NaN` cascades.
3.  Sanitize inputs to parsing functions (e.g., check `diceString` validity) before processing.

## 2024-05-25 - Core Loop Service Hardening
**Learning:** Central services like `TravelService` that are invoked during the main game loop (e.g., player movement) are single points of failure. Blindly casting inputs (e.g., `travelers as PlayerCharacter[]`) and passing them to calculation systems causes immediate crashes if the state is malformed (e.g., corrupted save, partial test data).
**Action:** Wrap critical public service methods in a top-level `try-catch` block that returns a safe "fallback result" (e.g., 0 distance, 0 time) instead of allowing the exception to propagate and white-screen the application. Validate complex array inputs (filter for valid objects) before processing.

## 2025-05-24 - Factory Fallback Pattern
**Learning:** When data conversion factories fail (e.g. `createAbilityFromSpell`), throwing an error often crashes the entire React component tree or game loop.
**Action:** Wrap the factory logic in a `try-catch` block that logs the error and returns a "Safe Object" (e.g. a "Fizzled Spell" ability with a distinctive icon like 🚫). This allows the game to continue running and visualizes the data corruption to the user/developer without a hard crash.
