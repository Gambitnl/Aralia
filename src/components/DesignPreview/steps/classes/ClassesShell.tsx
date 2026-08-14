import React, { useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Button } from '../../../ui/Button';
import {
  createClassesShellModel,
  getCanonicalClassSelectors,
  getCanonicalDefaultSelection,
  type ClassesShellClass,
  type ClassesShellSelection,
} from './classesDomainModel';
import { getSubclassDemo } from './subclassDemoRegistry';

/**
 * This component renders the unmounted Tactical Sandbox Classes selector contract. It
 * exists to give the future Rules host an accessible class row and nested subclass row,
 * with visible state and Reset behaviour. The host imports this component through the
 * local index export; this file does not modify the shared Design Preview host.
 */

// ============================================================================
// Public mount props
// ============================================================================
// These props let a future host seed a selection and observe changes without owning the
// canonical class or subclass lists itself.
export interface ClassesShellProps {
  initialClassId?: string;
  initialSubclassId?: string | null;
  onSelectionChange?: (selection: ClassesShellSelection) => void;
  className?: string;
}

// ============================================================================
// Keyboard navigation helpers
// ============================================================================
// Move across a horizontal tab row with the standard arrow, Home, and End keys. Buttons
// remain ordinary touch targets, so touch and pointer input use the same selection path.
function getKeyboardTargetId(
  currentId: string,
  ids: readonly string[],
  key: string,
): string | undefined {
  const currentIndex = ids.indexOf(currentId);

  // Ignore navigation keys when focus is not on one of this row's canonical tabs.
  if (currentIndex < 0) {
    return undefined;
  }

  if (key === 'Home') {
    return ids[0];
  }

  if (key === 'End') {
    return ids[ids.length - 1];
  }

  if (key !== 'ArrowLeft' && key !== 'ArrowRight') {
    return undefined;
  }

  // Wrapping keeps a long row usable when the final tab is reached by keyboard.
  const direction = key === 'ArrowRight' ? 1 : -1;
  return ids[(currentIndex + direction + ids.length) % ids.length];
}

// ============================================================================
// Tab row rendering
// ============================================================================
// Render one class row or subclass row with a common accessible tab contract. The selected
// class is also visibly styled, while aria-selected/data-selected expose the same truth.
function renderTabButton(
  id: string,
  label: string,
  selected: boolean,
  panelId: string,
  onSelect: () => void,
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void,
): React.ReactElement {
  return (
    <Button
      key={id}
      id={id}
      type="button"
      variant={selected ? 'action' : 'ghost'}
      size="md"
      role="tab"
      aria-selected={selected}
      aria-controls={panelId}
      tabIndex={selected ? 0 : -1}
      data-selected={selected ? 'true' : 'false'}
      className={[
        'min-h-11 rounded border px-3 py-2 text-left text-sm transition-colors',
        selected
          ? 'border-amber-400 bg-amber-500/20 text-amber-100'
          : 'border-slate-600 bg-slate-900/60 text-slate-300 hover:border-slate-400',
      ].join(' ')}
      onClick={onSelect}
      onKeyDown={onKeyDown}
    >
      {label}
    </Button>
  );
}

// ============================================================================
// Classes shell
// ============================================================================
// This is the integration-ready component. It owns only deterministic local selection;
// later subclass leaves can add mechanics beneath the selected nested tab without changing
// this shell's canonical inventory or the Rules host contract.
export const ClassesDomainShell: React.FC<ClassesShellProps> = ({
  initialClassId,
  initialSubclassId,
  onSelectionChange,
  className,
}) => {
  // Snapshot the canonical registry for this mount so every row uses one consistent order.
  const classes = useMemo(() => getCanonicalClassSelectors(), []);
  const initialModel = useMemo(
    () => createClassesShellModel(initialClassId, initialSubclassId),
    [initialClassId, initialSubclassId],
  );
  const [selection, setSelection] = useState<ClassesShellSelection>(initialModel.selection);
  const selectedClass = classes.find((characterClass) => characterClass.id === selection.classId) ?? classes[0];

  // Notify the future host only after a user action. Initial state remains deterministic
  // without requiring an effect that would report a selection before the host is mounted.
  const select = (nextSelection: ClassesShellSelection): void => {
    setSelection(nextSelection);
    onSelectionChange?.(nextSelection);
  };

  // Selecting a class always resets its nested row to the first canonical subclass.
  const selectClass = (characterClass: ClassesShellClass): void => {
    select({
      classId: characterClass.id,
      subclassId: characterClass.subclasses[0]?.id ?? null,
    });
  };

  // Selecting a subclass preserves the selected class and changes only the nested choice.
  const selectSubclass = (subclassId: string): void => {
    if (!selectedClass?.subclasses.some((subclass) => subclass.id === subclassId)) {
      return;
    }

    select({ classId: selectedClass.id, subclassId });
  };

  // Reset returns both rows to the source-authored first class and first subclass.
  const reset = (): void => {
    select(getCanonicalDefaultSelection(classes));
  };

  // Apply roving tabindex and focus to the next tab without changing the canonical order.
  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    ids: readonly string[],
    currentId: string,
    selectId: (id: string) => void,
    elementPrefix: string,
  ): void => {
    const targetId = getKeyboardTargetId(currentId, ids, event.key);

    // Let browser defaults handle activation keys; only arrow/Home/End are managed here.
    if (!targetId) {
      return;
    }

    event.preventDefault();
    selectId(targetId);
    document.getElementById(`${elementPrefix}-${targetId}`)?.focus();
  };

  // Keep the panel IDs tied to canonical IDs so an integrating host can target them safely.
  const classTabIds = classes.map((characterClass) => characterClass.id);
  const subclassTabIds = selectedClass?.subclasses.map((subclass) => subclass.id) ?? [];

  return (
    <section className={className} aria-label="Tactical Sandbox classes">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-100">Classes</h2>
        <Button
          type="button"
          variant="ghost"
          size="md"
          className="min-h-11 rounded border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:border-slate-400"
          onClick={reset}
        >
          Reset
        </Button>
      </div>

      <div
        role="tablist"
        aria-label="Classes"
        aria-orientation="horizontal"
        className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
      >
        {classes.map((characterClass) => {
          const tabId = `classes-tab-${characterClass.id}`;
          const panelId = `classes-panel-${characterClass.id}`;

          // Each button gets a stable ID, roving focus, and source-derived label.
          return renderTabButton(
            tabId,
            characterClass.name,
            selection.classId === characterClass.id,
            panelId,
            () => selectClass(characterClass),
            (event) => handleTabKeyDown(event, classTabIds, characterClass.id, (id) => {
              const nextClass = classes.find((candidate) => candidate.id === id);
              if (nextClass) {
                selectClass(nextClass);
              }
            }, 'classes-tab'),
          );
        })}
      </div>

      {selectedClass ? (
        <div
          id={`classes-panel-${selectedClass.id}`}
          role="tabpanel"
          aria-labelledby={`classes-tab-${selectedClass.id}`}
          className="mt-4 rounded border border-slate-700 bg-slate-950/40 p-3"
        >
          <p className="text-sm text-slate-300">Selected class: {selectedClass.name}</p>

          <div
            role="tablist"
            aria-label={`${selectedClass.name} subclasses`}
            aria-orientation="horizontal"
            className="mt-3 flex flex-wrap gap-2"
          >
            {selectedClass.subclasses.map((subclass) => {
              const tabId = `subclass-tab-${selectedClass.id}-${subclass.id}`;
              const panelId = `subclass-panel-${selectedClass.id}-${subclass.id}`;

              // The nested row is only the canonical selection contract; mechanics belong
              // to the one-subclass leaves that will mount beneath this panel later.
              return renderTabButton(
                tabId,
                subclass.name,
                selection.subclassId === subclass.id,
                panelId,
                () => selectSubclass(subclass.id),
                (event) => handleTabKeyDown(
                  event,
                  subclassTabIds,
                  subclass.id,
                  selectSubclass,
                  `subclass-tab-${selectedClass.id}`,
                ),
              );
            })}
          </div>

          {selection.subclassId ? (
            <div
              id={`subclass-panel-${selectedClass.id}-${selection.subclassId}`}
              role="tabpanel"
              aria-labelledby={`subclass-tab-${selectedClass.id}-${selection.subclassId}`}
              className="mt-3 text-sm text-slate-300"
            >
              Selected subclass:{' '}
              {selectedClass.subclasses.find((subclass) => subclass.id === selection.subclassId)?.name}
              {(() => {
                // Resolve the selected pair against the disjoint leaf registry. A missing
                // entry is a real implementation boundary, not permission to simulate
                // mechanics for a subclass whose leaf has not landed yet.
                const selectedSubclass = selectedClass.subclasses.find(
                  (subclass) => subclass.id === selection.subclassId,
                );
                const registeredDemo = getSubclassDemo(selectedClass.id, selection.subclassId);
                const Demo = registeredDemo?.Component;

                if (!selectedSubclass) {
                  return null;
                }

                if (Demo) {
                  return <Demo />;
                }

                return (
                  <p
                    data-testid="subclass-demo-boundary"
                    className="mt-3 rounded border border-amber-400/40 bg-amber-950/20 p-3 text-xs leading-relaxed text-amber-100"
                  >
                    No demonstration is registered for {selectedSubclass.name} yet. Canonical
                    subclass selection is available; mechanics remain deferred to its dedicated
                    subclass leaf.
                  </p>
                );
              })()}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};

// A named alias makes the later Rules mount explicit while retaining a descriptive domain
// name for direct imports in focused tests and future Design Preview composition.
export const ClassesShell = ClassesDomainShell;

export default ClassesDomainShell;
