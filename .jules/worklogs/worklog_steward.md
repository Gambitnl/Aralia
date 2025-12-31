# Steward's Journal

## 2024-05-23 - Initial Setup
**Learning:** Initialized the journal.
**Action:** Will record critical state/hook learnings here.

## 2025-12-30 - useTargetValidator Optimization
**Learning:** `useTargetSelection` was causing expensive re-calculations of Line-of-Sight on every HP update because `isValidTarget` reference was unstable.
**Action:** Implemented a topology-based validation in `useTargetValidator` that ignores non-structural updates (HP, cooldowns). Used `eslint-disable-next-line` to safely use stable closures over `characters`.
