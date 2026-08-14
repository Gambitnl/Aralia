/**
 * This file is the integration boundary for the Tactical Sandbox Classes domain. It
 * exists so a future Rules orchestrator can mount the shell and its canonical contract
 * from one stable path, without editing the shared top-tab host or this directory.
 */

// Export the component under both the domain name and the short mount name used by hosts.
export { ClassesDomainShell, ClassesShell } from './ClassesShell';
export { default } from './ClassesShell';
export { classesDomainModule } from './classesDomainModule';
export { getSubclassDemo, SUBCLASS_DEMO_REGISTRY } from './subclassDemoRegistry';
export type {
  SubclassDemoRegistration,
  SubclassDemoRegistry,
} from './subclassDemoRegistry';

// Export the read-only canonical adapter so focused tests and future leaves can inspect the
// same source-derived rows without introducing a second class or subclass registry.
export {
  createClassesShellModel,
  getCanonicalClasses,
  getCanonicalClassSelectors,
  getCanonicalDefaultSelection,
  resolveClassesShellSelection,
} from './classesDomainModel';

// Keep the public type contract available to a host without requiring implementation paths.
export type {
  ClassesShellClass,
  ClassesShellModel,
  ClassesShellSelection,
} from './classesDomainModel';
export type { ClassesShellProps } from './ClassesShell';
