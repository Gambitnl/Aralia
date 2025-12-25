## 2025-12-22 - Vitest Mock Hoisting
**Learning:** `vi.mock` calls are hoisted to the top of the file, meaning they run before any top-level variable declarations. Using variables (like mock components defined with `React.forwardRef`) inside a `vi.mock` factory will cause a `ReferenceError` unless those variables are defined *inside* the factory or created via `vi.hoisted`.
**Action:** When mocking modules that require complex return values (like React components), define them entirely inside the factory callback or use `vi.hoisted` to ensure they are available when the mock is registered.

## 2025-12-22 - Shared Data Mutation in Tests
**Learning:** Importing constant data objects (like `COMPANIONS` from `src/data/companions.ts`) directly into tests can lead to flaky tests if one test mutates the data (e.g., adding a property) and subsequent tests rely on the original state.
**Action:** Always verify if test data is immutable. If not, create a deep copy (e.g., `JSON.parse(JSON.stringify(DATA))`) in `beforeEach` to ensure each test runs with a pristine state.

## 2025-12-25 - Mocking Relative Imports in Nested Tests
**Learning:** When writing tests in a `__tests__` subdirectory (e.g., `src/utils/__tests__/file.test.ts`), calls to `vi.mock` must use paths relative to the test file, not the source file. If the source file imports `../constants`, the test must mock `../../constants` to target the same module, even though the import statement in the source remains `../constants`.
**Action:** Always verify `vi.mock` paths relative to the *test file* location, not the source file location.

## 2025-12-25 - Using `vi.hoisted` for Shared Mocks
**Learning:** To share mock data between `vi.mock` factories and test cases (e.g., ensuring the mock returns specific objects you can assert against), use `vi.hoisted` to define the variables. This bypasses the hoisting restriction that prevents accessing top-level variables inside `vi.mock`.
**Action:** Use `const { MOCK_DATA } = vi.hoisted(() => ({ MOCK_DATA: ... }))` pattern when mock data needs to be referenced in both the mock factory and the test body.
