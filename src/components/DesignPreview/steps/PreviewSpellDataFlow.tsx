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
  { bucket: 'Classes', tracker: 'TBD', kind: 'TBD', phase1Gate: 'done', phase2Gate: 'done', lastUpdated: '2026-05-25' },
  { bucket: 'Sub-Classes', tracker: 'TBD', kind: 'TBD', phase1Gate: 'done', phase2Gate: 'done', lastUpdated: '2026-05-25' },
  { bucket: 'Casting Time', tracker: 'TBD', kind: 'TBD', phase1Gate: 'done', phase2Gate: 'done', lastUpdated: '2026-05-25' },
  { bucket: 'Range/Area', tracker: 'TBD', kind: 'TBD', phase1Gate: 'done', phase2Gate: 'done', lastUpdated: '2026-05-25' },
  { bucket: 'Components', tracker: 'TBD', kind: 'TBD', phase1Gate: 'done', phase2Gate: 'done', lastUpdated: '2026-05-25' },
  { bucket: 'Material Component', tracker: 'TBD', kind: 'TBD', phase1Gate: 'done', phase2Gate: 'done', lastUpdated: '2026-05-25' },
  { bucket: 'Duration', tracker: 'TBD', kind: 'TBD', phase1Gate: 'done', phase2Gate: 'done', lastUpdated: '2026-05-25' },
  { bucket: 'Description', tracker: 'TBD', kind: 'TBD', phase1Gate: 'done', phase2Gate: 'done', lastUpdated: '2026-05-25' },
  { bucket: 'Higher Levels', tracker: 'TBD', kind: 'TBD', phase1Gate: 'done', phase2Gate: 'done', lastUpdated: '2026-05-25' },
  { bucket: 'School', tracker: 'TBD', kind: 'TBD', phase1Gate: 'done', phase2Gate: 'done', lastUpdated: '2026-05-25' },
  { bucket: 'Damage Type', tracker: 'TBD', kind: 'TBD', phase1Gate: 'done', phase2Gate: 'done', lastUpdated: '2026-05-25' },
  { bucket: 'Attack-Roll Riders', tracker: 'TBD', kind: 'TBD', phase1Gate: 'done', phase2Gate: 'done', lastUpdated: '2026-05-25' },
  { bucket: 'Conditions', tracker: 'TBD', kind: 'TBD', phase1Gate: 'done', phase2Gate: 'done', lastUpdated: '2026-05-25' },
  { bucket: 'Summoned Entities', tracker: 'TBD', kind: 'TBD', phase1Gate: 'done', phase2Gate: 'done', lastUpdated: '2026-05-25' },
  { bucket: 'Structured Markdown', tracker: 'TBD', kind: 'TBD', phase1Gate: 'done', phase2Gate: 'done', lastUpdated: '2026-05-25' },
];

const CLASSES_EXECUTION: PhaseBlock[] = [
  {
    phase: 'Phase 1',
    steps: [
      { status: 'done', subbucket: 'init_stub', count: '0 spells', countValue: 0 }
    ]
  }
];

const SUB_CLASSES_EXECUTION: PhaseBlock[] = [
  {
    phase: 'Phase 1',
    steps: [
      { status: 'done', subbucket: 'init_stub', count: '0 spells', countValue: 0 }
    ]
  }
];

const CASTING_TIME_EXECUTION_CANONICAL_FIRST: PhaseBlock[] = [
  {
    phase: 'Phase 1',
    steps: [
      { status: 'done', subbucket: 'init_stub', count: '0 spells', countValue: 0 }
    ]
  }
];

const RANGE_AREA_EXECUTION: PhaseBlock[] = [
  {
    phase: 'Phase 1',
    steps: [
      { status: 'done', subbucket: 'init_stub', count: '0 spells', countValue: 0 }
    ]
  }
];

const COMPONENTS_EXECUTION: PhaseBlock[] = [
  {
    phase: 'Phase 1',
    steps: [
      { status: 'done', subbucket: 'init_stub', count: '0 spells', countValue: 0 }
    ]
  }
];

const MATERIAL_COMPONENT_EXECUTION: PhaseBlock[] = [
  {
    phase: 'Phase 1',
    steps: [
      { status: 'done', subbucket: 'init_stub', count: '0 spells', countValue: 0 }
    ]
  }
];

const DURATION_EXECUTION: PhaseBlock[] = [
  {
    phase: 'Phase 1',
    steps: [
      { status: 'done', subbucket: 'init_stub', count: '0 spells', countValue: 0 }
    ]
  }
];

const DESCRIPTION_EXECUTION: PhaseBlock[] = [
  {
    phase: 'Phase 1',
    steps: [
      { status: 'done', subbucket: 'init_stub', count: '0 spells', countValue: 0 }
    ]
  }
];

const HIGHER_LEVELS_EXECUTION: PhaseBlock[] = [
  {
    phase: 'Phase 1',
    steps: [
      { status: 'done', subbucket: 'init_stub', count: '0 spells', countValue: 0 }
    ]
  }
];

const SCHOOL_EXECUTION: PhaseBlock[] = [
  {
    phase: 'Phase 1',
    steps: [
      { status: 'done', subbucket: 'init_stub', count: '0 spells', countValue: 0 }
    ]
  }
];

const DAMAGE_TYPE_EXECUTION: PhaseBlock[] = [
  {
    phase: 'Phase 1',
    steps: [
      { status: 'done', subbucket: 'init_stub', count: '0 spells', countValue: 0 }
    ]
  }
];

const ATTACK_ROLL_RIDERS_EXECUTION: PhaseBlock[] = [
  {
    phase: 'Phase 1',
    steps: [
      { status: 'done', subbucket: 'init_stub', count: '0 spells', countValue: 0 }
    ]
  }
];

const CONDITIONS_EXECUTION: PhaseBlock[] = [
  {
    phase: 'Phase 1',
    steps: [
      { status: 'done', subbucket: 'init_stub', count: '0 spells', countValue: 0 }
    ]
  }
];

const SUMMONED_ENTITIES_EXECUTION: PhaseBlock[] = [
  {
    phase: 'Phase 1',
    steps: [
      { status: 'done', subbucket: 'init_stub', count: '0 spells', countValue: 0 }
    ]
  }
];

const STRUCTURED_MARKDOWN_EXECUTION: PhaseBlock[] = [
  {
    phase: 'Phase 1',
    steps: [
      { status: 'done', subbucket: 'init_stub', count: '0 spells', countValue: 0 }
    ]
  }
];

const STUB_EXECUTION: PhaseBlock[] = [];
const EMPTY_BUCKET_EXECUTION: PhaseBlock[] = [];

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
  return <div>Spell Data Flow Preview</div>;
}
