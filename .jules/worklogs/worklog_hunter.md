# Hunter's Journal

## 2024-05-22 - [Journal Init] **Learning:** Initialized Hunter's journal. **Action:** Record critical learnings here.

## 2024-05-24 - [Commands Missing Context] **Learning:** The `BaseEffectCommand` constructor requires a `CommandContext` object, but many existing tests (and potentially legacy code) only pass partial data or stubbed objects, leading to `TypeError: Cannot read properties of undefined` when new features try to access properties like `caster.id` deeply. **Action:** When testing commands, ensure the `CommandContext` is robustly mocked using factories or explicit object literals that match the interface, rather than relying on `any` casts.
