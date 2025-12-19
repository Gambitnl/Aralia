# Planeshifter's Worklog

## 2024-05-22 - Planar Integration
**Learning:** Planar mechanics were defined in data but completely disconnected from the combat engine. The `Ability` system relied on static properties created at character load time, making dynamic environmental effects (like "Magic is stronger here") impossible without refactoring the execution pipeline.
**Action:** When designing environmental systems, ensure the *execution context* (Command Pattern) includes the environment state, not just the actor state.
