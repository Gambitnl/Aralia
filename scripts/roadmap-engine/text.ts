import path from 'path';
import type { RoadmapNode } from './types';

export const slug = (value: string) => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .slice(0, 120);

export const normalizeState = (value?: string): RoadmapNode['status'] => {
  const v = (value || '').toLowerCase();
  if (v.includes('done') || v.includes('complete') || v.includes('verified')) return 'done';
  if (v.includes('active') || v.includes('ongoing') || v.includes('in_progress')) return 'active';
  if (v.includes('planned') || v.includes('pending') || v.includes('concept')) return 'planned';
  return 'active';
};

export const toTitleCase = (value: string) => {
  const preserve = new Set([
    'UI', 'UX', 'API', 'VS', 'VSCODE', 'TS', 'TSX', 'JSON', 'PHB', 'D&D', '3D', '2D', 'RPG', 'MAPDATA', 'SET_MAP_DATA', 'MOVE_PLAYER'
  ]);
  const preserveDisplay: Record<string, string> = {
    VSCODE: 'VSCode',
    MAPDATA: 'MapData'
  };
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const upper = word.toUpperCase();
      if (preserveDisplay[upper]) return preserveDisplay[upper];
      if (preserve.has(upper)) return upper;
      if (/^[0-9]+[a-z]*$/i.test(word)) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
};

export const humanizeDocTitle = (sourcePath: string) => {
  const file = path.basename(sourcePath).replace(/\.md$/i, '');
  const cleaned = file
    .replace(/^@+/, '')
    .replace(/~/g, '')
    .replace(/^[0-9]+[a-z]?[-_. ]+/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return 'Feature Doc';
  return toTitleCase(cleaned
    .replace(/acceptance criteria/ig, 'Validation Criteria')
    .replace(/readme/ig, 'Blueprint')
    .replace(/summary/ig, 'Delivery Outcomes')
    .replace(/implementation plan/ig, 'Execution Plan')
    .replace(/workflow/ig, 'Execution Flow')
    .replace(/task template/ig, 'Task Blueprint')
    .replace(/start here/ig, 'Onboarding Checklist'));
};

const sanitizeSubfeatureName = (raw: string) => raw
  .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
  .replace(/\*\*/g, '')
  .replace(/`/g, '')
  .replace(/^[-*]\s+/, '')
  .replace(/^[0-9]+(?:\.[0-9]+)*[).:-]?\s*/, '')
  .replace(/^[A-Z][).:-]?\s+/, '')
  .replace(/^[^\p{L}\p{N}]+/gu, '')
  .replace(/[:;.,]+$/, '')
  .replace(/\s*\(line[s]?\s*[\d-]+\)\s*$/i, '')
  .replace(/\s+/g, ' ')
  .trim();

const isGenericSubfeature = (name: string) => {
  const v = name.toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim();
  const genericPatterns = [
    /^overview$/,
    /^status$/,
    /^status overview$/,
    /^current status$/,
    /^implementation status$/,
    /^summary$/,
    /^executive summary$/,
    /^deliverable$/,
    /^deliverables$/,
    /^key deliverables$/,
    /^acceptance criteria$/,
    /^testing$/,
    /^testing requirements$/,
    /^implementation steps$/,
    /^implementation plan$/,
    /^workflow$/,
    /^readme$/,
    /^start here$/,
    /^task template$/,
    /^context$/,
    /^context and problem$/,
    /^notes$/,
    /^dependencies$/,
    /^verification$/,
    /^verification plan$/,
    /^objectives?$/,
    /^goals?$/,
    /^constraints?$/,
    /^metadata$/,
    /^open questions?$/,
    /^prerequisites$/,
    /^inputs$/,
    /^integration$/,
    /^integration points$/,
    /^requirements$/,
    /^problem$/,
    /^problem statement$/,
    /^affected files$/,
    /^related files$/,
    /^quick start$/,
    /^action items$/,
    /^task list$/,
    /^all tasks$/,
    /^active tasks$/,
    /^completed$/,
    /^files to modify$/,
    /^benefits$/,
    /^assigned persona$/,
    /^execution steps$/,
    /^implementation details$/,
    /^implementation phases$/,
    /^high-level approach$/,
    /^detailed requirements$/,
    /^detailed implementation by feat$/,
    /^current progress\b/,
    /^current state assessment\b/,
    /^known issues /,
    /^findings & recommendations$/,
    /^method \(how to do the mapping\)$/,
    /^definitions \(use these consistently\)$/,
    /^architecture$/,
    /^core components$/,
    /^core infrastructure$/,
    /^key features$/,
    /^message categories$/
  ];
  return genericPatterns.some((p) => p.test(v));
};

const isWeakSubfeatureLabel = (name: string) => {
  const v = name.trim();
  const tokens = v.split(/\s+/).filter(Boolean);
  if (tokens.length <= 2) return true;
  if (/scope$/i.test(v)) return true;
  if (/^phase\s+\d+/i.test(v)) return true;
  if (/^[0-9]+\s+[A-Za-z]/.test(v)) return true;
  return false;
};

const is3DPlanningMetaSegment = (segment: string) => {
  const v = segment.toLowerCase().replace(/\s+/g, ' ').trim();
  const patterns = [
    /^phase\s*\d/,
    /^phase \d/,
    /^roadmap phases$/,
    /^questionnaire\b/,
    /^one-sentence vision$/,
    /^architecture sketch$/,
    /^core constraints and decisions$/,
    /^current coupling inventory$/,
    /^decouple answer\b/,
    /^non-goals\b/,
    /^non-negotiables\b/,
    /^persistence and autosave$/,
    /^map generation source and world seed entry points$/,
    /^travel interaction from world map clicks$/,
    /^type contracts and compatibility layer$/,
    /^reducer\/state update logic$/,
    /^world map render and map modal shell$/,
    /^biome config is split across multiple "truth sources"$/,
    /^determinism is underspecified for "world continuity"$/,
    /^macro features exist, but the feature graph is too thin$/,
    /^3d exploration roadmap scope$/,
    /^3d integration design plan scope$/,
    /^phase 0 - foundations$/,
    /^phase 1 - data pipeline and caching$/,
    /^roadmap phases$/
  ];
  return patterns.some((p) => p.test(v));
};

const is3DUmbrellaGroupingSegment = (segment: string) => {
  const v = segment.toLowerCase().replace(/\s+/g, ' ').trim();
  return [
    'delivered capabilities',
    'delivery pipeline',
    'design constraints',
    'hardening backlog',
    'map renderer decoupling',
    'r1 parity validation',
    'quality gates',
    'execution tracking'
  ].includes(v);
};

const applyFeatureHierarchyPreference = (segments: string[], featureName: string) => {
  const normalized = [...segments];
  const is3DFeature = featureName.toLowerCase() === '3d exploration & combat';
  if (!is3DFeature) return normalized;

  // Strip meta/planning wrappers so capability nodes become first-class children.
  while (normalized.length > 1 && is3DPlanningMetaSegment(normalized[0])) {
    normalized.shift();
  }
  while (normalized.length > 1 && is3DUmbrellaGroupingSegment(normalized[0])) {
    normalized.shift();
  }

  if (normalized.length === 1 && (is3DPlanningMetaSegment(normalized[0]) || is3DUmbrellaGroupingSegment(normalized[0]))) {
    return [] as string[];
  }

  return normalized;
};

const map3DOperationalEntryToCapability = (root: string, entry: string): string => {
  const v = entry.toLowerCase();
  const rootKey = root.toLowerCase();

  const mapped = (rules: Array<{ pattern: RegExp; label: string }>) => {
    for (const rule of rules) {
      if (rule.pattern.test(v)) return rule.label;
    }
    return null;
  };

  const deliveryRules = [
    { pattern: /r1 parity checks/, label: 'Atlas Parity Regression Suite' },
    { pattern: /validate .*world-generation lock ux/, label: 'World-Generation Lock UX Validation' },
    { pattern: /r2 cleanup.*legacy world-map renderer/, label: 'Legacy Grid Renderer Retirement' },
    { pattern: /full azgaar component extraction\/integration/, label: 'Azgaar Generation Backend Completion' },
    { pattern: /continuity contract work/, label: 'Cross-Tile Continuity Contract' },
    { pattern: /option triage pass.*runtime option manifest/, label: 'Runtime Option Manifest Finalization' }
  ];

  const parityRules = [
    { pattern: /open world map .* verify iframe loads/, label: 'Atlas Embed Boot Validation' },
    { pattern: /click center .*near-edge atlas positions/, label: 'Atlas Click-to-Move Accuracy Validation' },
    { pattern: /perform save.*open map.*same world seed/, label: 'Seed-Persistent Save/Load Validation' },
    { pattern: /perform save/, label: 'Seed-Persistent Save/Load Validation' },
    { pattern: /enter submap after atlas-based move/, label: 'Submap Anchor Coherence Validation' },
    { pattern: /record any atlas click mismatch/, label: 'Atlas Click Edge-Case Capture' },
    { pattern: /click-travel snapping rule details/, label: 'Click-Snapping Rule Finalization' },
    { pattern: /final azgaar module boundary selection/, label: 'Azgaar Module Boundary Decision' }
  ];

  const decoupleRules = [
    { pattern: /detailed coupling inventory .*decouple plan/, label: 'Coupling Inventory Mapping' },
    { pattern: /we will decouple in sequence/, label: 'Decouple Sequencing Plan' },
    { pattern: /renderer decouple first/, label: 'Atlas Renderer Swap Contract' },
    { pattern: /grid ui decouple second/, label: 'Legacy Grid UI Detachment' },
    { pattern: /protected during renderer migration/, label: 'Renderer Migration Guardrails' },
    { pattern: /mapdata\.tiles compatibility/, label: 'MapData Tile Compatibility Contract' },
    { pattern: /moveplayer .* setmapdata contracts/, label: 'State Action Contract Preservation' },
    { pattern: /save\/load world seed persistence/, label: 'World Seed Persistence Contract' },
    { pattern: /submap hidden-cell anchoring/, label: 'Hidden-Cell Submap Anchor Contract' }
  ];

  const backlogRules = [
    { pattern: /locked-world guard sweep/, label: 'Locked-World Mutation Guardrails' },
    { pattern: /burg tools review/, label: 'Burg Tool Mutation Audit' },
    { pattern: /command-category suppression policy/, label: 'Locked-Mode Command Suppression Policy' }
  ];

  const designConstraintRules = [
    {
      pattern: /primary world generation path is full azgaar component integration/,
      label: 'World Map > Generation & Determinism > Azgaar World Generation Backbone'
    },
    {
      pattern: /world map presentation target is seamless atlas style by default/,
      label: 'World Map > Visuals > Continuous World Map View - No Visible Tile Grid'
    },
    {
      pattern: /travel\/movement mode can expose optional overlays .* toggles; default off/,
      label: 'World Map > Navigation > Travel Precision Overlay Controls'
    },
    {
      pattern: /states\/borders are allowed in phase 1 as toggleable visual layers/,
      label: 'World Map > Visuals > Azgaar Layer Controls > Political Borders (Toggleable)'
    }
  ];

  const historyRules = [
    { pattern: /cache-busting query parameter/, label: 'Azgaar Embed Cache-Invalidation' },
    { pattern: /step-based quick travel payload support|quick travel handler .* step-by-step/, label: 'Step-Based Travel Execution Engine' },
    { pattern: /per-step encounter interruption behavior/, label: 'Encounter Interrupt-On-Step Flow' },
    { pattern: /soft edge telegraph ui/, label: 'Submap Boundary Telegraph UX' },
    { pattern: /stage r1 renderer swap .*read-only azgaar atlas embed/, label: 'Read-Only Atlas Renderer Integration' },
    { pattern: /pan\/zoom .*travel interaction toggle/, label: 'Atlas Interaction Mode Toggle' },
    { pattern: /transform-aware atlas click-to-travel mapping/, label: 'Transform-Aware Click-to-Travel Mapping' },
    { pattern: /world-generation lock policy/, label: 'World-Generation Lock Policy' },
    { pattern: /setworldseed state action/, label: 'Seed-State Synchronization Action' },
    { pattern: /preconfigured-world handoff/, label: 'Preconfigured World Start Handoff' },
    { pattern: /deterministic edge-port continuity .*roads and rivers/, label: 'Road/River Edge Continuity Contract' },
    { pattern: /edge-port continuity .*cliff/, label: 'Cliff Edge Continuity Contract' },
    { pattern: /deterministic map generation tests/, label: 'Deterministic Map Generation Tests' },
    { pattern: /continuity tests .*edge matching/, label: 'Cross-Tile Continuity Test Suite' },
    { pattern: /cliff continuity test coverage/, label: 'Cliff Continuity Test Coverage' },
    { pattern: /module 404|iframe module 404|embed 404|base path mismatch/, label: 'Atlas Embed Runtime Path Hardening' },
    { pattern: /legacy generator fallback path/, label: 'Legacy Generator Fallback Guard' },
    { pattern: /main-menu world generation entry point/, label: 'Pre-Run World Generation Entry Flow' },
    { pattern: /pre-run regeneration controls/, label: 'Pre-Run Seed Regeneration Controls' },
    { pattern: /hard-disabling destructive actions/, label: 'Read-Only Azgaar Action Lockdown' },
    { pattern: /full-scope roadmap file .*3d\/world integration requirements/, label: '3D Exploration Implementation Roadmap Baseline' },
    { pattern: /world-map-rewire-mapping\.md .*decouple stages/, label: 'World-Map Rewire Contract Artifact' },
    { pattern: /seed-stable azgaar embed url generation/, label: 'Seed-Stable Atlas Embed URL' },
    { pattern: /existing auto-save toggle path/, label: 'Auto-Save Toggle Continuity' },
    { pattern: /initial phase 1a world-source swap stub/, label: 'Azgaar World Source Default Path' },
    { pattern: /two concrete r1 runtime blockers/, label: 'R1 Runtime Blocker Resolution' },
    { pattern: /regeneration is blocked when save data exists/, label: 'World Regeneration Lock Gate' },
    { pattern: /typecheck successfully/, label: 'Typecheck Stability Validation' }
  ];

  let resolved: string | null = null;
  if (rootKey === 'delivery pipeline') resolved = mapped(deliveryRules);
  else if (rootKey === 'r1 parity validation') resolved = mapped(parityRules);
  else if (rootKey === 'map renderer decoupling') resolved = mapped(decoupleRules);
  else if (rootKey === 'hardening backlog') resolved = mapped(backlogRules);
  else if (rootKey === 'design constraints') resolved = mapped(designConstraintRules);
  else if (rootKey === 'delivered capabilities') resolved = mapped(historyRules);

  if (resolved) return resolved;

  const condensed = entry
    .replace(/^[A-Za-z][A-Za-z\s/-]*:\s*/, '')
    .replace(/^(added|implemented|fixed|enabled|converted|extended|replaced|resolved|locked and implemented|preserved|ran)\s+/i, '')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return toTitleCase(condensed || entry);
};

const normalize3DImplementationSegments = (segments: string[]): string[] | null => {
  if (segments.length === 0) return null;
  const first = segments[0].toLowerCase();

  if (
    first === 'objective'
    || first === 'execution discipline (mandatory)'
    || first === 'layman model clarification'
    || first === 'questionnaire traceability'
  ) {
    return null;
  }

  let normalized = [...segments];
  if (normalized[0].toLowerCase() === 'phase roadmap') {
    normalized = normalized.slice(1);
  }

  const rootRenames: Record<string, string> = {
    'decouple contract': 'Map Renderer Decoupling',
    'locked decisions': 'Design Constraints',
    'verification plan': 'Quality Gates',
    'completed in this pass': 'Delivered Capabilities',
    'next up': 'Delivery Pipeline',
    'immediate r1 parity checklist': 'R1 Parity Validation',
    'backlog (non-gating, do not derail next phase)': 'Hardening Backlog',
    'execution progress': 'Execution Tracking'
  };

  if (normalized.length > 0) {
    const key = normalized[0].toLowerCase();
    if (rootRenames[key]) normalized[0] = rootRenames[key];
  }

  normalized = normalized.filter((segment) => Boolean(segment && segment.trim()));
  if (normalized.length === 0) return null;

  if (normalized.length >= 2) {
    const mappedSecond = map3DOperationalEntryToCapability(normalized[0], normalized[1]);
    const operationalRoots = new Set([
      'delivery pipeline',
      'r1 parity validation',
      'delivered capabilities',
      'hardening backlog',
      'map renderer decoupling'
    ]);
    if (operationalRoots.has(normalized[0].toLowerCase())) {
      normalized = [normalized[0], mappedSecond];
    } else if (normalized[0].toLowerCase() === 'design constraints' && mappedSecond.includes('>')) {
      normalized = mappedSecond
        .split('>')
        .map((segment) => segment.trim())
        .filter(Boolean);
    } else {
      normalized[1] = mappedSecond;
    }
  }

  return normalized;
};

export const toFeatureDrivenSubfeatureName = (rawName: string, featureName: string, sourcePath: string): string | null => {
  const docTitle = humanizeDocTitle(sourcePath);
  const rawSegments = rawName
    .split('>')
    .map((segment) => sanitizeSubfeatureName(segment))
    .filter(Boolean);

  let baseSegments = rawSegments.length > 0 ? rawSegments : [docTitle];
  if (sourcePath.toLowerCase() === 'docs/tasks/3d-exploration/implementation_plan.md') {
    const mapped = normalize3DImplementationSegments(baseSegments);
    if (!mapped) return null;
    baseSegments = mapped;
  }

  const normalizedSegments = baseSegments.map((segment, index) => {
    const componentMatch = segment.match(/([A-Za-z0-9_./-]+)\.tsx$/i) || segment.match(/([A-Za-z0-9_./-]+)$/);
    if (componentMatch && /\.(tsx|ts|jsx|js)$/i.test(componentMatch[1])) {
      const componentBase = componentMatch[1].split('/').pop() || componentMatch[1];
      const name = componentBase.replace(/\.(tsx|ts|jsx|js)$/i, '');
      return `${name} Integration`;
    }

    if (isGenericSubfeature(segment)) {
      if (index === 0) return baseSegments.length > 1 ? '' : `${docTitle} Scope`;
      return `${toTitleCase(segment)} Scope`;
    }

    if (isWeakSubfeatureLabel(segment)) return toTitleCase(segment);
    return toTitleCase(segment);
  }).filter(Boolean);

  let preferredSegments = normalizedSegments;
  if (preferredSegments.length > 0 && preferredSegments[0].toLowerCase() === featureName.toLowerCase()) {
    preferredSegments = preferredSegments.slice(1);
  }
  preferredSegments = applyFeatureHierarchyPreference(preferredSegments, featureName);

  if (preferredSegments.length === 0) {
    return null;
  }

  const is3DFeature = featureName.toLowerCase() === '3d exploration & combat';
  const startsAtWorldMap = preferredSegments[0].toLowerCase() === 'world map';
  if (is3DFeature && startsAtWorldMap) {
    return preferredSegments.join(' > ');
  }

  return `${featureName} > ${preferredSegments.join(' > ')}`;
};

export const summarizeDocs = (docsList: string[]) => docsList.join(' | ');
