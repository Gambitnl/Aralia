/**
 * @file src/components/Compendium/index.ts
 *
 * Central export hub for all PHB 2024 Compendium UI components.
 *
 * Why it exists:
 * Exposes the CompendiumModal, the unified CompendiumRuleTables dashboard,
 * and individual rule table views (ConditionTable, CoverObscurementTable,
 * CombatActionsTable, and WeaponMasteryTable) to the rest of the application.
 *
 * Connects to:
 * - src/components/Compendium/ConditionTable.tsx
 * - src/components/Compendium/CoverObscurementTable.tsx
 * - src/components/Compendium/CombatActionsTable.tsx
 * - src/components/Compendium/WeaponMasteryTable.tsx
 * - src/components/Compendium/CompendiumRuleTables.tsx
 * - src/components/Compendium/CompendiumModal.tsx
 */

export * from './ConditionTable';
export * from './CoverObscurementTable';
export * from './CombatActionsTable';
export * from './WeaponMasteryTable';
export * from './CompendiumRuleTables';
export * from './CompendiumModal';
