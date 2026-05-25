// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/05/2026, 05:43:31
 * Dependents: components/DesignPreview/DesignPreviewPage.tsx, spell-pipeline-atlas.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React from 'react';

/**
 * This file renders the Spell Pipeline Atlas bucket map.
 *
 * The Atlas gives Spell Phase agents a visible checklist for the major spell
 * data buckets that feed character creation, spellbooks, combat execution, and
 * later validation gates. It is intentionally tracked in Git now because the
 * earlier local-only copy could not be seen by Jules or clean GitHub checkouts.
 *
 * Called by: src/spell-pipeline-atlas.tsx
 * Depends on: authored bucket metadata below, plus scripts/auditAtlasBuckets.mjs
 * for repeatable proof that the map is not empty or drifting silently.
 */

// ============================================================================
// Atlas Types
// ============================================================================
// These small types describe the rows that appear on the Atlas page and the
// execution checkpoints attached to each bucket. They are kept in this file so
// the visual page and the audit script read the same source of truth.
// ============================================================================

type BucketName =
  | 'Classes'
  | 'Sub-Classes'
  | 'Casting Time'
  | 'Range/Area'
  | 'Components'
  | 'Material Component'
  | 'Duration'
  | 'Description'
  | 'Higher Levels'
  | 'School'
  | 'Damage Type'
  | 'Attack-Roll Riders'
  | 'Conditions'
  | 'Summoned Entities'
  | 'Structured Markdown';

type StepStatus = 'done' | 'active' | 'queued';

type PhaseStep = {
  label: string;
  status: StepStatus;
  subbucket: string;
  count: string;
  countValue: number | null;
  detail: string;
  dependsOn?: string[];
  overlapsWith?: string[];
};

type PhaseBlock = {
  phase: string;
  summary: string;
  steps: PhaseStep[];
};

type BucketMeta = {
  bucket: BucketName;
  tracker: string;
  kind: string;
  phase1Gate: string;
  phase2Gate: string;
  lastUpdated: string;
  note?: string;
};

// ============================================================================
// Bucket Metadata
// ============================================================================
// Each row names a spell-data bucket and its current proof posture. Dates use
// the audit anchor from the original local Atlas so the restored source can be
// checked without pretending the whole spell project was refreshed today.
// ============================================================================

const BUCKET_META: Array<{
  bucket: BucketName;
  tracker: string;
  kind: string;
  phase1Gate: string;
  phase2Gate: string;
  lastUpdated: string;
  note?: string;
}> = [
  { bucket: 'Classes', tracker: 'SPELL_PHASE_1_TASK_TRACKER.md#P2', kind: 'caster availability', phase1Gate: 'active', phase2Gate: 'queued', lastUpdated: '2026-05-02', note: 'Premade and creator class access is present, but higher-level coverage still needs later proof.' },
  { bucket: 'Sub-Classes', tracker: 'SPELL_PHASE_1_TASK_TRACKER.md#P3', kind: 'feature-granted spells', phase1Gate: 'active', phase2Gate: 'queued', lastUpdated: '2026-05-02', note: 'Creator visibility exists; subclass spell grants remain a separate deeper pass.' },
  { bucket: 'Casting Time', tracker: 'SPELL_PHASE_1_TASK_TRACKER.md#P4', kind: 'action economy', phase1Gate: 'active', phase2Gate: 'queued', lastUpdated: '2026-05-02', note: 'Canonical-first casting-time execution is the live map; the old orphan constant was intentionally not restored.' },
  { bucket: 'Range/Area', tracker: 'SPELL_PHASE_1_TASK_TRACKER.md#G48', kind: 'targeting geometry', phase1Gate: 'active', phase2Gate: 'queued', lastUpdated: '2026-05-02', note: 'Basic targeting proof exists through deterministic combat spells, with area nuance still open.' },
  { bucket: 'Components', tracker: 'SPELL_PHASE_1_TASK_TRACKER.md#P6', kind: 'casting requirements', phase1Gate: 'active', phase2Gate: 'queued', lastUpdated: '2026-05-02', note: 'Component parsing is tracked, while costly material behavior stays outside this package.' },
  { bucket: 'Material Component', tracker: 'SPELL_PHASE_1_TASK_TRACKER.md#G48', kind: 'inventory cost hooks', phase1Gate: 'active', phase2Gate: 'queued', lastUpdated: '2026-05-02', note: 'Material text is visible but most inventory consumption rules remain future work.' },
  { bucket: 'Duration', tracker: 'SPELL_PHASE_1_TASK_TRACKER.md#P4', kind: 'ongoing effects', phase1Gate: 'active', phase2Gate: 'queued', lastUpdated: '2026-05-02', note: 'Concentration and status duration proof exists for pilot spells, with broader timing still open.' },
  { bucket: 'Description', tracker: 'SPELL_PHASE_1_TASK_TRACKER.md#P5', kind: 'player-facing rules text', phase1Gate: 'active', phase2Gate: 'queued', lastUpdated: '2026-05-02', note: 'AI arbitration covers some descriptive spells; deterministic extraction remains bucket-specific.' },
  { bucket: 'Higher Levels', tracker: 'SPELL_PHASE_1_TASK_TRACKER.md#P4', kind: 'scaling behavior', phase1Gate: 'active', phase2Gate: 'queued', lastUpdated: '2026-05-02', note: 'Fireball and pilot damage paths exist, but all upcast paths are not closed.' },
  { bucket: 'School', tracker: 'SPELL_PHASE_1_TASK_TRACKER.md#P1', kind: 'spell taxonomy', phase1Gate: 'active', phase2Gate: 'queued', lastUpdated: '2026-05-02', note: 'School metadata is mostly classification proof rather than combat behavior.' },
  { bucket: 'Damage Type', tracker: 'SPELL_PHASE_1_TASK_TRACKER.md#P6', kind: 'damage routing', phase1Gate: 'active', phase2Gate: 'queued', lastUpdated: '2026-05-02', note: 'Choice or mode work covers several damage-type selections; full resistance interaction remains later.' },
  { bucket: 'Attack-Roll Riders', tracker: 'SPELL_PHASE_1_TASK_TRACKER.md#G49', kind: 'd20 modifiers', phase1Gate: 'active', phase2Gate: 'queued', lastUpdated: '2026-05-02', note: 'Bless and Bane attack or save modifiers are explicitly queued after Package 7.' },
  { bucket: 'Conditions', tracker: 'SPELL_PHASE_1_TASK_TRACKER.md#P4', kind: 'status effects', phase1Gate: 'active', phase2Gate: 'queued', lastUpdated: '2026-05-02', note: 'Pilot status application exists, while condition-specific edge rules still need narrower packages.' },
  { bucket: 'Summoned Entities', tracker: 'SPELL_PHASE_1_TASK_TRACKER.md#G48', kind: 'created actors', phase1Gate: 'active', phase2Gate: 'queued', lastUpdated: '2026-05-02', note: 'Summon handling is visible as a bucket but not closed by early deterministic pilots.' },
  { bucket: 'Structured Markdown', tracker: 'SPELL_PHASE_1_TASK_TRACKER.md#P1', kind: 'source normalization', phase1Gate: 'active', phase2Gate: 'queued', lastUpdated: '2026-05-02', note: 'Structured spell text is the reference layer for later mechanics extraction.' },
];

// ============================================================================
// Execution Blocks
// ============================================================================
// Each bucket receives a small but real execution map. These are not completion
// claims for every spell; they preserve the checkpoint shape and explain what
// evidence currently exists, what is being worked, and what remains queued.
// ============================================================================

const CLASSES_EXECUTION: PhaseBlock[] = [
  { phase: 'Phase 1 - early-game class spell access', summary: 'Track whether cantrip through level 3 spells can be selected by the classes that should see them.', steps: [{ label: 'Class spell lists visible in creator and premade data', status: 'active', subbucket: 'class_spell_lists', count: '12 classes', countValue: 12, detail: 'Package 2 and Package 3 provide the current class-facing proof surface.' }] },
  { phase: 'Phase 2 - higher-level class coverage', summary: 'Later phases can expand class coverage beyond the early-game spell range.', steps: [{ label: 'Higher-level spell access audit', status: 'queued', subbucket: 'higher_level_class_lists', count: '6 levels', countValue: 6, detail: 'Levels 4 through 9 are intentionally outside Spell Phase 1.' }] },
];

const SUB_CLASSES_EXECUTION: PhaseBlock[] = [
  { phase: 'Phase 1 - feature-granted spell visibility', summary: 'Track subclass and feature spell grants that affect early spell choices.', steps: [{ label: 'Creator locked spell visibility', status: 'active', subbucket: 'feature_spell_visibility', count: '1 live path', countValue: 1, detail: 'Package 3 proved locked feature spell cards can be visible without being user-toggleable.' }] },
  { phase: 'Phase 2 - subclass matrix expansion', summary: 'Broader subclass coverage should be audited after the core early spell loop is stable.', steps: [{ label: 'Subclass spell matrix review', status: 'queued', subbucket: 'subclass_spell_matrix', count: '0 closed', countValue: 0, detail: 'No broad subclass matrix is claimed by Package 7.' }] },
];

const CASTING_TIME_EXECUTION_CANONICAL_FIRST: PhaseBlock[] = [
  { phase: 'Phase 1 - canonical action economy map', summary: 'Use the canonical casting-time map as the live entry instead of the obsolete orphan constant.', steps: [{ label: 'Action, bonus action, and reaction labels feed combat command selection', status: 'active', subbucket: 'canonical_casting_time', count: '3 action groups', countValue: 3, detail: 'The old CASTING_TIME_EXECUTION orphan was deliberately left out so the audit proves the live map only.' }] },
  { phase: 'Phase 2 - timing edge cases', summary: 'Long-cast and ritual timing require separate runtime treatment.', steps: [{ label: 'Long-cast timing policies', status: 'queued', subbucket: 'long_cast_timing', count: '0 closed', countValue: 0, detail: 'This Atlas repair does not implement new action-economy mechanics.' }] },
];

const RANGE_AREA_EXECUTION: PhaseBlock[] = [
  { phase: 'Phase 1 - target and area visibility', summary: 'Keep targeting and area fields discoverable for deterministic combat and later geometry checks.', steps: [{ label: 'Pilot spell target ranges visible to combat tests', status: 'active', subbucket: 'target_range_visibility', count: '5 pilot spells', countValue: 5, detail: 'Package 4 uses pilot spells for direct targeting proof, while area shape nuance remains open.' }] },
  { phase: 'Phase 2 - tactical area geometry', summary: 'Battle-map area placement and obstacle interaction belong to later package work.', steps: [{ label: 'Area template runtime checks', status: 'queued', subbucket: 'area_template_runtime', count: '0 closed', countValue: 0, detail: 'No BattleMap geometry changes are part of Package 7.' }] },
];

const COMPONENTS_EXECUTION: PhaseBlock[] = [
  { phase: 'Phase 1 - verbal somatic material parsing', summary: 'Track whether component data is present and visible without claiming inventory enforcement.', steps: [{ label: 'Component flags present for early spells', status: 'active', subbucket: 'component_flags', count: '3 component kinds', countValue: 3, detail: 'Verbal, somatic, and material flags are data proof, not full casting-resource enforcement.' }] },
  { phase: 'Phase 2 - component restriction runtime', summary: 'Future work can connect components to silence, restraint, and inventory rules.', steps: [{ label: 'Restriction hooks', status: 'queued', subbucket: 'component_restrictions', count: '0 closed', countValue: 0, detail: 'Runtime restrictions stay outside this Atlas source repair.' }] },
];

const MATERIAL_COMPONENT_EXECUTION: PhaseBlock[] = [
  { phase: 'Phase 1 - material text discoverability', summary: 'Keep material component text visible as source data for future inventory-cost work.', steps: [{ label: 'Material text review path', status: 'active', subbucket: 'material_text', count: '1 tracker path', countValue: 1, detail: 'The Atlas records the bucket honestly without saying costly components are implemented.' }] },
  { phase: 'Phase 2 - material consumption', summary: 'Costly, consumed, and reusable materials need inventory semantics later.', steps: [{ label: 'Inventory consumption policy', status: 'queued', subbucket: 'material_consumption', count: '0 closed', countValue: 0, detail: 'No inventory consumption behavior is added by Package 7.' }] },
];

const DURATION_EXECUTION: PhaseBlock[] = [
  { phase: 'Phase 1 - concentration and status duration proof', summary: 'Track the pilot duration paths already exercised by combat tests.', steps: [{ label: 'Concentration marker and status duration pilot', status: 'active', subbucket: 'concentration_status_duration', count: '1 live pilot', countValue: 1, detail: 'Bless applies a status and concentration marker, while modifier math remains G49.' }] },
  { phase: 'Phase 2 - timed expiration rules', summary: 'Round-by-round expiration and unusual durations need a separate runtime pass.', steps: [{ label: 'Duration expiration scheduler', status: 'queued', subbucket: 'duration_expiration', count: '0 closed', countValue: 0, detail: 'Package 7 only restores Atlas proof.' }] },
];

const DESCRIPTION_EXECUTION: PhaseBlock[] = [
  { phase: 'Phase 1 - descriptive spell handling', summary: 'Separate flavor-heavy descriptions from deterministic mechanics when the data cannot fully drive behavior.', steps: [{ label: 'AI arbitration pilot for descriptive spells', status: 'active', subbucket: 'ai_arbitration_descriptions', count: '2 spells', countValue: 2, detail: 'Package 5 covers prestidigitation and suggestion as an arbitration pilot.' }] },
  { phase: 'Phase 2 - deterministic extraction', summary: 'More description text can be converted to structured mechanics as buckets mature.', steps: [{ label: 'Mechanics extraction backlog', status: 'queued', subbucket: 'description_mechanics_backlog', count: '0 closed', countValue: 0, detail: 'The Atlas names the backlog without expanding this package.' }] },
];

const HIGHER_LEVELS_EXECUTION: PhaseBlock[] = [
  { phase: 'Phase 1 - early scaling proof', summary: 'Track whether upcast or higher-level variants are visible in early spell tests.', steps: [{ label: 'Pilot scaling paths', status: 'active', subbucket: 'pilot_scaling', count: '1 live path', countValue: 1, detail: 'Damage pilots give initial proof, but all level 1 to 3 scaling is not closed.' }] },
  { phase: 'Phase 2 - full upcast matrix', summary: 'Full scaling coverage should be dispatched as narrower mechanics packages.', steps: [{ label: 'Upcast matrix audit', status: 'queued', subbucket: 'upcast_matrix', count: '0 closed', countValue: 0, detail: 'No broad higher-level scaling repair is claimed here.' }] },
];

const SCHOOL_EXECUTION: PhaseBlock[] = [
  { phase: 'Phase 1 - school metadata visibility', summary: 'Keep school taxonomy visible as a low-risk classification bucket.', steps: [{ label: 'School labels available to spell views', status: 'active', subbucket: 'school_labels', count: '8 schools', countValue: 8, detail: 'School is mostly display and filtering context for Phase 1.' }] },
  { phase: 'Phase 2 - school-driven mechanics', summary: 'Any school-specific mechanics can be added later if rules demand them.', steps: [{ label: 'School mechanics hooks', status: 'queued', subbucket: 'school_mechanics', count: '0 closed', countValue: 0, detail: 'No school-specific runtime behavior is added by this package.' }] },
];

const DAMAGE_TYPE_EXECUTION: PhaseBlock[] = [
  { phase: 'Phase 1 - damage type routing', summary: 'Track explicit and choice-driven damage types used by early combat spells.', steps: [{ label: 'Choice or mode damage type source', status: 'active', subbucket: 'damage_type_source', count: '3 spells', countValue: 3, detail: 'Package 6 added deterministic damage type selection for several mode-choice spells.' }] },
  { phase: 'Phase 2 - resistance and immunity proof', summary: 'Damage-type interaction with defenses belongs to later combat verification.', steps: [{ label: 'Resistance interaction tests', status: 'queued', subbucket: 'resistance_interactions', count: '0 closed', countValue: 0, detail: 'No resistance behavior is changed by Package 7.' }] },
];

const ATTACK_ROLL_RIDERS_EXECUTION: PhaseBlock[] = [
  { phase: 'Phase 1 - d20 rider gap tracking', summary: 'Make attack and save modifier gaps visible before the next mechanics package starts.', steps: [{ label: 'Bless and Bane modifier gap', status: 'active', subbucket: 'attack_save_modifier_gap', count: '2 spells', countValue: 2, detail: 'G49 tracks Bless plus Bane attack and saving throw modifier data after Atlas repair.', overlapsWith: ['Conditions:status_application'] }] },
  { phase: 'Phase 2 - generalized roll rider engine', summary: 'A broader d20 rider engine can be designed after the scoped Bless and Bane pass.', steps: [{ label: 'General roll rider policy', status: 'queued', subbucket: 'roll_rider_policy', count: '0 closed', countValue: 0, detail: 'No modifier runtime is added by this Atlas repair.' }] },
];

const CONDITIONS_EXECUTION: PhaseBlock[] = [
  { phase: 'Phase 1 - status application proof', summary: 'Track condition and status application already exercised by pilot combat spells.', steps: [{ label: 'Status application in combat pilot', status: 'active', subbucket: 'status_application', count: '1 live pilot', countValue: 1, detail: 'Package 4 proves basic status placement; individual condition rules remain narrower follow-ups.' }] },
  { phase: 'Phase 2 - condition-specific behavior', summary: 'Each complex condition should receive focused runtime proof.', steps: [{ label: 'Condition rule matrix', status: 'queued', subbucket: 'condition_rule_matrix', count: '0 closed', countValue: 0, detail: 'Package 7 does not broaden condition mechanics.' }] },
];

const SUMMONED_ENTITIES_EXECUTION: PhaseBlock[] = [
  { phase: 'Phase 1 - summon bucket visibility', summary: 'Keep summon creation visible as an explicit bucket rather than hiding it under flavor text.', steps: [{ label: 'Summon bucket named for future actor work', status: 'active', subbucket: 'summon_bucket_visibility', count: '1 bucket', countValue: 1, detail: 'The Atlas records the bucket without claiming actor creation support.' }] },
  { phase: 'Phase 2 - actor creation runtime', summary: 'Summoned creatures and objects need a future actor lifecycle package.', steps: [{ label: 'Summon actor lifecycle', status: 'queued', subbucket: 'summon_actor_lifecycle', count: '0 closed', countValue: 0, detail: 'No summoned actor runtime is changed by Package 7.' }] },
];

const STRUCTURED_MARKDOWN_EXECUTION: PhaseBlock[] = [
  { phase: 'Phase 1 - structured source normalization', summary: 'Track the structured text layer that feeds bucket-specific extraction.', steps: [{ label: 'Structured markdown as source context', status: 'active', subbucket: 'structured_source_context', count: '1 source layer', countValue: 1, detail: 'Structured spell text remains the source layer for mechanics discovery and later package scopes.' }] },
  { phase: 'Phase 2 - schema completeness', summary: 'Schema completeness should be proven bucket by bucket rather than through this Atlas repair.', steps: [{ label: 'Schema completeness sweep', status: 'queued', subbucket: 'schema_completeness', count: '0 closed', countValue: 0, detail: 'Package 7 restores the map and audit path, not every schema field.' }] },
];

const EXECUTION_BY_BUCKET: Record<BucketName, PhaseBlock[]> = {
  'Classes': CLASSES_EXECUTION,
  'Sub-Classes': SUB_CLASSES_EXECUTION,
  'Casting Time': CASTING_TIME_EXECUTION_CANONICAL_FIRST,
  'Range/Area': RANGE_AREA_EXECUTION,
  'Components': COMPONENTS_EXECUTION,
  'Material Component': MATERIAL_COMPONENT_EXECUTION,
  'Duration': DURATION_EXECUTION,
  'Description': DESCRIPTION_EXECUTION,
  'Higher Levels': HIGHER_LEVELS_EXECUTION,
  'School': SCHOOL_EXECUTION,
  'Damage Type': DAMAGE_TYPE_EXECUTION,
  'Attack-Roll Riders': ATTACK_ROLL_RIDERS_EXECUTION,
  'Conditions': CONDITIONS_EXECUTION,
  'Summoned Entities': SUMMONED_ENTITIES_EXECUTION,
  'Structured Markdown': STRUCTURED_MARKDOWN_EXECUTION,
};

// ============================================================================
// Display Helpers
// ============================================================================
// These helpers turn the authored Atlas data into compact labels. Keeping the
// helpers small makes the page useful without turning Package 7 into a broad UI
// redesign task.
// ============================================================================

const statusLabel: Record<StepStatus, string> = {
  done: 'Done',
  active: 'Active',
  queued: 'Queued',
};

function getBucketActivity(bucket: BucketName) {
  const phases = EXECUTION_BY_BUCKET[bucket];
  const steps = phases.flatMap((phase) => phase.steps);
  const activeStep = steps.find((step) => step.status === 'active');
  const queuedCount = steps.filter((step) => step.status === 'queued').length;

  return {
    activeStep,
    queuedCount,
    totalSteps: steps.length,
  };
}

// ============================================================================
// React View
// ============================================================================
// The page shows one row per bucket, with enough detail for a future foreman to
// tell whether the bucket is proof-ready, active, or merely queued for later.
// ============================================================================

export function PreviewSpellDataFlow() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
        <header className="border-b border-slate-800 pb-4">
          <p className="text-sm uppercase tracking-wide text-cyan-300">Spell Phase 1</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Spell Pipeline Atlas</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Git-tracked checkpoint map for cantrips and level 1-3 spell data buckets.
            This surface is intentionally honest about active work: it restores Atlas
            discoverability without claiming that every bucket is complete.
          </p>
        </header>

        <div className="overflow-hidden rounded border border-slate-800 bg-slate-900/70">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-900 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Bucket</th>
                <th className="px-4 py-3 font-medium">Kind</th>
                <th className="px-4 py-3 font-medium">Phase 1</th>
                <th className="px-4 py-3 font-medium">Active checkpoint</th>
                <th className="px-4 py-3 font-medium">Queued</th>
                <th className="px-4 py-3 font-medium">Tracker</th>
              </tr>
            </thead>
            <tbody>
              {BUCKET_META.map((meta) => {
                const activity = getBucketActivity(meta.bucket);

                return (
                  <tr key={meta.bucket} className="border-t border-slate-800">
                    <td className="px-4 py-3 align-top font-medium text-white">{meta.bucket}</td>
                    <td className="px-4 py-3 align-top text-slate-300">{meta.kind}</td>
                    <td className="px-4 py-3 align-top">
                      <span className="rounded bg-cyan-950 px-2 py-1 text-xs text-cyan-200">
                        {meta.phase1Gate}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-300">
                      <div className="font-medium text-slate-100">
                        {activity.activeStep ? activity.activeStep.label : 'No active checkpoint'}
                      </div>
                      <div className="mt-1 text-xs leading-5 text-slate-400">
                        {activity.activeStep ? activity.activeStep.detail : meta.note}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-300">
                      {activity.queuedCount} of {activity.totalSteps}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-400">{meta.tracker}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          {BUCKET_META.map((meta) => (
            <article key={`${meta.bucket}-detail`} className="rounded border border-slate-800 bg-slate-900 p-4">
              <h2 className="text-base font-semibold text-white">{meta.bucket}</h2>
              <p className="mt-1 text-sm text-slate-400">{meta.note}</p>
              <div className="mt-4 space-y-3">
                {EXECUTION_BY_BUCKET[meta.bucket].map((phase) => (
                  <div key={`${meta.bucket}-${phase.phase}`} className="border-l border-slate-700 pl-3">
                    <div className="text-sm font-medium text-slate-100">{phase.phase}</div>
                    <div className="text-xs leading-5 text-slate-400">{phase.summary}</div>
                    <ul className="mt-2 space-y-1">
                      {phase.steps.map((step) => (
                        <li key={`${meta.bucket}-${step.subbucket}`} className="text-xs text-slate-300">
                          <span className="font-medium text-cyan-200">{statusLabel[step.status]}</span>
                          {' - '}
                          {step.label}
                          <span className="text-slate-500"> ({step.count})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
