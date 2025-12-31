## 2025-12-30 - Mocking Data Modules
**Learning:** When unit testing logic that depends on large external data files (like `FEATS_DATA`), mocking the data module allows for precise control over test scenarios (e.g., creating a specific feat for testing retroactive HP) without relying on the actual data content, which might change. This isolates the logic test from data changes.
**Action:** Use `vi.mock('../../path/to/data', () => ({ DATA: [...] }))` to provide minimal, focused test data for unit logic tests.
