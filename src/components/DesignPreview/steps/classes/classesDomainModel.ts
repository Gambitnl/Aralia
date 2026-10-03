import { CLASSES_DATA } from '../../../../data/classes';
import { subclassesForClass, type Subclass } from '../../../../data/classes/subclasses';
import type { Class as CharacterClass } from '../../../../types/character';

/**
 * This file turns the production class and subclass registries into the small selection
 * contract that the Tactical Sandbox Classes shell needs. It exists so the preview can
 * expose canonical choices without copying game data into a UI module. The shell calls
 * these read-only helpers, and the later Rules host can consume the same contract.
 */

// ============================================================================
// Canonical selector shapes
// ============================================================================
// This shape keeps the UI-facing data small while retaining the source order and the
// complete canonical subclass objects for the selected class.
export interface ClassesShellClass {
  id: string;
  name: string;
  description: string;
  subclasses: readonly Subclass[];
}

// This selection is the only state the host needs to persist or pass to another leaf.
// A class without canonical subclasses uses null rather than an invented placeholder.
export interface ClassesShellSelection {
  classId: string;
  subclassId: string | null;
}

// This model is useful to future mounts that need the selected class and its nested row
// without depending on rendered DOM. It deliberately carries only canonical data.
export interface ClassesShellModel {
  classes: readonly ClassesShellClass[];
  selectedClass: ClassesShellClass;
  selection: ClassesShellSelection;
}

// ============================================================================
// Read-only canonical adapter
// ============================================================================
// Read the object insertion order authored in CLASSES_DATA. Sorting here would make the
// preview disagree with the production registry and would hide future authored order.
export function getCanonicalClasses(): readonly CharacterClass[] {
  return Object.values(CLASSES_DATA);
}

// Derive the nested row from the production subclass helper for every class. No class or
// subclass names are repeated in this adapter, so new canonical data remains discoverable.
export function getCanonicalClassSelectors(): readonly ClassesShellClass[] {
  return getCanonicalClasses().map((characterClass) => ({
    id: characterClass.id,
    name: characterClass.name,
    description: characterClass.description,
    subclasses: subclassesForClass(characterClass.id),
  }));
}

// Use the first authored class and its first authored subclass as the deterministic reset
// point. The null fallback keeps this contract valid if a future class has no subclasses.
export function getCanonicalDefaultSelection(
  classes: readonly ClassesShellClass[] = getCanonicalClassSelectors(),
): ClassesShellSelection {
  const firstClass = classes[0];

  // A valid production registry always has classes, but this guard keeps a malformed
  // preview mount from crashing while the data source is being repaired.
  if (!firstClass) {
    return { classId: '', subclassId: null };
  }

  return {
    classId: firstClass.id,
    subclassId: firstClass.subclasses[0]?.id ?? null,
  };
}

// Resolve requested IDs against the canonical rows. Invalid or stale IDs return to the
// authored default, and changing class always selects that class's first subclass.
export function resolveClassesShellSelection(
  classes: readonly ClassesShellClass[],
  requestedClassId?: string,
  requestedSubclassId?: string | null,
): ClassesShellSelection {
  const fallback = getCanonicalDefaultSelection(classes);
  const selectedClass = classes.find((characterClass) => characterClass.id === requestedClassId);

  // Unknown class IDs cannot identify a canonical nested row, so reset both levels.
  if (!selectedClass) {
    return fallback;
  }

  // A caller that names a class but omits a subclass receives its canonical first option.
  const selectedSubclass = selectedClass.subclasses.find(
    (subclass) => subclass.id === requestedSubclassId,
  );

  return {
    classId: selectedClass.id,
    subclassId: selectedSubclass?.id ?? selectedClass.subclasses[0]?.id ?? null,
  };
}

// Build the complete mount contract from canonical data and a possibly persisted selection.
export function createClassesShellModel(
  requestedClassId?: string,
  requestedSubclassId?: string | null,
): ClassesShellModel {
  const classes = getCanonicalClassSelectors();
  const selection = resolveClassesShellSelection(classes, requestedClassId, requestedSubclassId);
  const selectedClass = classes.find((characterClass) => characterClass.id === selection.classId) ?? classes[0];

  // The registry guard above makes this unreachable for the current canonical data, but a
  // clear error is safer than returning a model with an impossible selected class.
  if (!selectedClass) {
    throw new Error('Classes shell requires at least one canonical class.');
  }

  return { classes, selectedClass, selection };
}
