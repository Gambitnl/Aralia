## 2025-12-22 - Vitest Mock Hoisting
**Learning:** `vi.mock` calls are hoisted to the top of the file, meaning they run before any top-level variable declarations. Using variables (like mock components defined with `React.forwardRef`) inside a `vi.mock` factory will cause a `ReferenceError` unless those variables are defined *inside* the factory or created via `vi.hoisted`.
**Action:** When mocking modules that require complex return values (like React components), define them entirely inside the factory callback or use `vi.hoisted` to ensure they are available when the mock is registered.

## 2025-12-22 - Shared Data Mutation in Tests
**Learning:** Importing constant data objects (like `COMPANIONS` from `src/data/companions.ts`) directly into tests can lead to flaky tests if one test mutates the data (e.g., adding a property) and subsequent tests rely on the original state.
**Action:** Always verify if test data is immutable. If not, create a deep copy (e.g., `JSON.parse(JSON.stringify(DATA))`) in `beforeEach` to ensure each test runs with a pristine state.
