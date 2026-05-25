import React from 'react';

export type PhaseBlock = {
  phase: string;
  steps: {
    status: 'open' | 'active' | 'done' | 'queued' | 'in-progress' | 'resolved' | 'policy';
    subbucket?: string;
    count?: string;
    countValue?: number | null;
    dependsOn?: string[];
    overlapsWith?: string[];
  }[];
};

export const BUCKET_META: Array<{ bucket: string, tracker: string, kind: string, phase1Gate: string, phase2Gate: string, lastUpdated: string, note?: string }> = [
  { bucket: 'Classes', tracker: 'docs/tasks/spells/PACKAGE_7_ATLAS_LOCAL_SOURCE_CONTEXT.md', kind: 'historical', phase1Gate: 'unknown', phase2Gate: 'unknown', lastUpdated: '2026-05-25' },
  { bucket: 'Sub-Classes', tracker: 'docs/tasks/spells/PACKAGE_7_ATLAS_LOCAL_SOURCE_CONTEXT.md', kind: 'historical', phase1Gate: 'unknown', phase2Gate: 'unknown', lastUpdated: '2026-05-25' },
  { bucket: 'Casting Time', tracker: 'docs/tasks/spells/PACKAGE_7_ATLAS_LOCAL_SOURCE_CONTEXT.md', kind: 'historical', phase1Gate: 'unknown', phase2Gate: 'unknown', lastUpdated: '2026-05-25' },
  { bucket: 'Range/Area', tracker: 'docs/tasks/spells/PACKAGE_7_ATLAS_LOCAL_SOURCE_CONTEXT.md', kind: 'historical', phase1Gate: 'unknown', phase2Gate: 'unknown', lastUpdated: '2026-05-25' },
  { bucket: 'Components', tracker: 'docs/tasks/spells/PACKAGE_7_ATLAS_LOCAL_SOURCE_CONTEXT.md', kind: 'historical', phase1Gate: 'unknown', phase2Gate: 'unknown', lastUpdated: '2026-05-25' },
  { bucket: 'Material Component', tracker: 'docs/tasks/spells/PACKAGE_7_ATLAS_LOCAL_SOURCE_CONTEXT.md', kind: 'historical', phase1Gate: 'unknown', phase2Gate: 'unknown', lastUpdated: '2026-05-25' },
  { bucket: 'Duration', tracker: 'docs/tasks/spells/PACKAGE_7_ATLAS_LOCAL_SOURCE_CONTEXT.md', kind: 'historical', phase1Gate: 'unknown', phase2Gate: 'unknown', lastUpdated: '2026-05-25' },
  { bucket: 'Description', tracker: 'docs/tasks/spells/PACKAGE_7_ATLAS_LOCAL_SOURCE_CONTEXT.md', kind: 'historical', phase1Gate: 'unknown', phase2Gate: 'unknown', lastUpdated: '2026-05-25' },
  { bucket: 'Higher Levels', tracker: 'docs/tasks/spells/PACKAGE_7_ATLAS_LOCAL_SOURCE_CONTEXT.md', kind: 'historical', phase1Gate: 'unknown', phase2Gate: 'unknown', lastUpdated: '2026-05-25' },
  { bucket: 'School', tracker: 'docs/tasks/spells/PACKAGE_7_ATLAS_LOCAL_SOURCE_CONTEXT.md', kind: 'historical', phase1Gate: 'unknown', phase2Gate: 'unknown', lastUpdated: '2026-05-25' },
  { bucket: 'Damage Type', tracker: 'docs/tasks/spells/PACKAGE_7_ATLAS_LOCAL_SOURCE_CONTEXT.md', kind: 'historical', phase1Gate: 'unknown', phase2Gate: 'unknown', lastUpdated: '2026-05-25' },
  { bucket: 'Attack-Roll Riders', tracker: 'docs/tasks/spells/PACKAGE_7_ATLAS_LOCAL_SOURCE_CONTEXT.md', kind: 'historical', phase1Gate: 'unknown', phase2Gate: 'unknown', lastUpdated: '2026-05-25' },
  { bucket: 'Conditions', tracker: 'docs/tasks/spells/PACKAGE_7_ATLAS_LOCAL_SOURCE_CONTEXT.md', kind: 'historical', phase1Gate: 'unknown', phase2Gate: 'unknown', lastUpdated: '2026-05-25' },
  { bucket: 'Summoned Entities', tracker: 'docs/tasks/spells/PACKAGE_7_ATLAS_LOCAL_SOURCE_CONTEXT.md', kind: 'historical', phase1Gate: 'unknown', phase2Gate: 'unknown', lastUpdated: '2026-05-25' },
  { bucket: 'Structured Markdown', tracker: 'docs/tasks/spells/PACKAGE_7_ATLAS_LOCAL_SOURCE_CONTEXT.md', kind: 'historical', phase1Gate: 'unknown', phase2Gate: 'unknown', lastUpdated: '2026-05-25' },
];

const CLASSES_EXECUTION: PhaseBlock[] = [
  {
    phase: 'Phase 1',
    steps: [
      { status: 'open', subbucket: 'historical_recovery', count: 'unknown' }
    ]
  }
];
const SUB_CLASSES_EXECUTION: PhaseBlock[] = [
  {
    phase: 'Phase 1',
    steps: [
      { status: 'open', subbucket: 'historical_recovery', count: 'unknown' }
    ]
  }
];
const CASTING_TIME_EXECUTION_CANONICAL_FIRST: PhaseBlock[] = [
  {
    phase: 'Phase 1',
    steps: [
      { status: 'open', subbucket: 'historical_recovery', count: 'unknown' }
    ]
  }
];
const RANGE_AREA_EXECUTION: PhaseBlock[] = [
  {
    phase: 'Phase 1',
    steps: [
      { status: 'open', subbucket: 'historical_recovery', count: 'unknown' }
    ]
  }
];
const COMPONENTS_EXECUTION: PhaseBlock[] = [
  {
    phase: 'Phase 1',
    steps: [
      { status: 'open', subbucket: 'historical_recovery', count: 'unknown' }
    ]
  }
];
const MATERIAL_COMPONENT_EXECUTION: PhaseBlock[] = [
  {
    phase: 'Phase 1',
    steps: [
      { status: 'open', subbucket: 'historical_recovery', count: 'unknown' }
    ]
  }
];
const DURATION_EXECUTION: PhaseBlock[] = [
  {
    phase: 'Phase 1',
    steps: [
      { status: 'open', subbucket: 'historical_recovery', count: 'unknown' }
    ]
  }
];
const DESCRIPTION_EXECUTION: PhaseBlock[] = [
  {
    phase: 'Phase 1',
    steps: [
      { status: 'open', subbucket: 'historical_recovery', count: 'unknown' }
    ]
  }
];
const HIGHER_LEVELS_EXECUTION: PhaseBlock[] = [
  {
    phase: 'Phase 1',
    steps: [
      { status: 'open', subbucket: 'historical_recovery', count: 'unknown' }
    ]
  }
];
const SCHOOL_EXECUTION: PhaseBlock[] = [
  {
    phase: 'Phase 1',
    steps: [
      { status: 'open', subbucket: 'historical_recovery', count: 'unknown' }
    ]
  }
];
const DAMAGE_TYPE_EXECUTION: PhaseBlock[] = [
  {
    phase: 'Phase 1',
    steps: [
      { status: 'open', subbucket: 'historical_recovery', count: 'unknown' }
    ]
  }
];
const ATTACK_ROLL_RIDERS_EXECUTION: PhaseBlock[] = [
  {
    phase: 'Phase 1',
    steps: [
      { status: 'open', subbucket: 'historical_recovery', count: 'unknown' }
    ]
  }
];
const CONDITIONS_EXECUTION: PhaseBlock[] = [
  {
    phase: 'Phase 1',
    steps: [
      { status: 'open', subbucket: 'historical_recovery', count: 'unknown' }
    ]
  }
];
const SUMMONED_ENTITIES_EXECUTION: PhaseBlock[] = [
  {
    phase: 'Phase 1',
    steps: [
      { status: 'open', subbucket: 'historical_recovery', count: 'unknown' }
    ]
  }
];
const STRUCTURED_MARKDOWN_EXECUTION: PhaseBlock[] = [
  {
    phase: 'Phase 1',
    steps: [
      { status: 'open', subbucket: 'historical_recovery', count: 'unknown' }
    ]
  }
];

const STUB_EXECUTION: PhaseBlock[] = [];
const EMPTY_BUCKET_EXECUTION: PhaseBlock[] = [];

// Removed orphaned CASTING_TIME_EXECUTION as the canonical-first map is the source of truth

const EXECUTION_BY_BUCKET = {
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

export function PreviewSpellDataFlow() {
  return <div>Spell Data Flow Preview (Historical)</div>;
}
