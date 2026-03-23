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
    'UI', 'UX', 'API', 'URL', 'AI', 'NPC', 'VS', 'VSCODE', 'TS', 'TSX', 'JSON', 'PHB', 'D&D', '3D', '2D', 'RPG', 'MAPDATA', 'SET_MAP_DATA', 'MOVE_PLAYER'
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

// Technical: canonical capability map for 3D implementation-plan lines that are otherwise
// phrased as project stages/checklists.
// Layman: this converts "process wording" into stable feature/component/subcomponent paths.
const WORLD_MAP_CAPABILITY_RULES: Array<{ pattern: RegExp; label: string }> = [
  // Generation and deterministic behavior
  { pattern: /primary world generation path is full azgaar component integration|phase 1a - extract\/adapt azgaar|complete full azgaar component extraction\/integration|initial phase 1a world-source swap stub/, label: 'World Map > Generation & Determinism > Backend > Azgaar World Generation Backbone' },
  { pattern: /new game must start with a new world seed/, label: 'World Map > Generation & Determinism > Seed Lifecycle > New-Game Seed Randomization' },
  { pattern: /seed persists within-session and across save\/load|save\/load world seed persistence|perform save -> reload -> open map; verify same world seed/, label: 'World Map > Generation & Determinism > Seed Lifecycle > Save/Load Seed Persistence' },
  { pattern: /setworldseed state action/, label: 'World Map > Generation & Determinism > Seed Lifecycle > Seed State Synchronization' },
  { pattern: /preconfigured-world handoff/, label: 'World Map > Generation & Determinism > Seed Lifecycle > Preconfigured World Handoff' },
  { pattern: /time-of-day must not mutate deterministic terrain\/layout generation/, label: 'World Map > Generation & Determinism > Terrain Recipe Invariance' },
  { pattern: /deterministic map generation tests/, label: 'World Map > Generation & Determinism > Verification > Deterministic Map Generation Test Suite' },
  { pattern: /final azgaar module boundary selection/, label: 'World Map > Generation & Determinism > Backend > Azgaar Module Boundary Selection' },
  { pattern: /runtime option manifest|option triage pass/, label: 'World Map > Generation & Determinism > Runtime Configuration > Runtime Option Manifest' },

  // Rendering and visual layers
  { pattern: /world map presentation target is seamless atlas style by default|continuous map.*one seamless world atlas|phase 1b - replace square-tile world presentation|atlas view is default and no longer looks like exposed square map tiles/, label: 'World Map > Rendering > Atlas Presentation > Continuous World Atlas View' },
  { pattern: /azgaar-style macro geography is visible/, label: 'World Map > Rendering > Atlas Presentation > Macro Geography Layer Fidelity' },
  { pattern: /states\/borders are allowed in phase 1 as toggleable visual layers|political borders/i, label: 'World Map > Rendering > Layer Controls > Political Borders (Toggleable)' },
  { pattern: /phase 1d - add map layer toggles|menu \+ layer toggles/, label: 'World Map > Rendering > Layer Controls > Runtime Layer Toggle Suite' },
  { pattern: /stage r1 renderer swap .*read-only azgaar atlas embed/, label: 'World Map > Rendering > Atlas Embed > Read-Only Azgaar Embed' },
  { pattern: /seed-stable azgaar embed url generation/, label: 'World Map > Rendering > Atlas Embed > Seed-Stable Embed URL' },
  { pattern: /cache-busting query parameter/, label: 'World Map > Rendering > Atlas Embed > Runtime Cache Busting' },
  { pattern: /module 404|iframe module 404|base path mismatch|\/vendor\/azgaar\/index\.html 404|relative \.\/index-/, label: 'World Map > Rendering > Atlas Embed > Runtime Path Hardening' },
  { pattern: /r2 cleanup.*legacy world-map renderer|remove obsolete legacy world-map renderer|grid ui decouple second/, label: 'World Map > Rendering > Legacy Grid Retirement' },

  // Interaction and navigation controls
  { pattern: /pan\/zoom .*travel interaction toggle/, label: 'World Map > Interaction > Mode Toggle > Pan/Zoom vs Travel Toggle' },
  { pattern: /travel\/movement mode can expose optional overlays .* toggles; default off|travel precision overlay controls/, label: 'World Map > Interaction > Mode Toggle > Travel Precision Overlay Controls' },
  { pattern: /transform-aware atlas click-to-travel mapping|clicking anywhere on the atlas can snap to nearest hidden world cell|phase 1c - keep travel deterministic by snapping click targets/, label: 'World Map > Navigation > Click Targeting > Transform-Aware Hidden-Cell Mapping' },
  { pattern: /click-travel snapping rule details/, label: 'World Map > Navigation > Click Targeting > Snapping Rule Finalization' },
  { pattern: /soft edge telegraph ui|edge traversal uses soft telegraphing|edge cue appears before crossing boundaries/, label: 'World Map > Navigation > Boundary Handling > Soft Edge Telegraph' },

  // Step travel and timing
  { pattern: /step-based quick travel payload support|quick travel handler .* step-by-step|quick travel: convert from teleport to ordered step execution/, label: 'World Map > Travel > Step Execution > Ordered Cell-Step Traversal' },
  { pattern: /per-step encounter interruption behavior|encounter can interrupt remaining route/, label: 'World Map > Travel > Step Execution > Encounter Interrupt-After-Step' },
  { pattern: /submap travel should be step-based; each crossed cell costs real-time delay|3s target currently/, label: 'World Map > Travel > Timing Model > Per-Cell Real-Time Delay' },

  // Submap continuity contracts
  { pattern: /submap hidden-cell anchoring|submap generation is anchored to a world cell|enter submap after atlas-based move/, label: 'World Map > Submap Continuity > Anchor Model > Hidden-Cell Submap Anchoring' },
  { pattern: /deterministic edge-port continuity .*roads and rivers|create deterministic border-port system for roads\/rivers\/cliffs|neighbor tile transitions preserve path\/river\/cliff continuity/, label: 'World Map > Submap Continuity > Edge Contracts > Road/River Edge Continuity' },
  { pattern: /edge-port continuity .*cliff|impassable cliff bands/, label: 'World Map > Submap Continuity > Edge Contracts > Cliff Edge Continuity' },
  { pattern: /continuity tests .*edge matching|cliff continuity test coverage/, label: 'World Map > Submap Continuity > Verification > Edge Continuity Test Coverage' },

  // Safety and lock controls
  { pattern: /world-generation lock policy|world-regeneration lock policy|regeneration is blocked when save data exists/, label: 'World Map > Safety & Locking > Regeneration Lock Policy' },
  { pattern: /hard-disabling destructive actions|locked-world guard sweep|disable or intercept all tool actions under regenerate, add, and create/, label: 'World Map > Safety & Locking > Embedded Tool Mutation Lockdown' },
  { pattern: /burg tools review/, label: 'World Map > Safety & Locking > Burg Tool Mutation Audit' },
  { pattern: /command-category suppression policy/, label: 'World Map > Safety & Locking > Command Category Suppression Policy' },
  { pattern: /validate the new main-menu world-generation lock ux|validate .*world-generation lock ux/, label: 'World Map > Safety & Locking > Lock UX Validation' },

  // Setup and entry flow
  { pattern: /main-menu world generation entry point/, label: 'World Map > Setup UX > Main Menu World Generation Entry' },
  { pattern: /pre-run regeneration controls/, label: 'World Map > Setup UX > Pre-Run Seed Controls' },

  // Verification tracks
  { pattern: /run r1 parity checks/, label: 'World Map > Verification > R1 Parity Validation Suite' },
  { pattern: /open world map .* verify iframe loads/, label: 'World Map > Verification > Atlas Embed Boot Validation' },
  { pattern: /click center .*near-edge atlas positions/, label: 'World Map > Verification > Click-to-Move Accuracy Validation' },
  { pattern: /record any atlas click mismatch/, label: 'World Map > Verification > Click Edge-Case Capture' },

  // Implementation artifacts
  { pattern: /detailed coupling inventory .*decouple plan|world-map-rewire-mapping\.md/, label: 'World Map > Integration Contracts > Coupling Inventory and Rewire Contract' },
  { pattern: /renderer decouple first|mapdata\.tiles compatibility|moveplayer .* setmapdata contracts|protected during renderer migration/, label: 'World Map > Integration Contracts > Renderer Swap Contract Preservation' }
];

const map3DImplementationEntryToCapability = (entry: string): string | null => {
  const value = entry.toLowerCase();
  for (const rule of WORLD_MAP_CAPABILITY_RULES) {
    if (rule.pattern.test(value)) return rule.label;
  }
  return null;
};

const normalize3DImplementationSegments = (segments: string[]): string[] | null => {
  if (segments.length === 0) return null;

  const normalized = segments
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (normalized.length === 0) return null;

  const root = normalized[0].toLowerCase();
  if (
    root === 'objective'
    || root === 'execution discipline (mandatory)'
    || root === 'layman model clarification'
    || root === 'questionnaire traceability'
    || root === 'execution order'
  ) {
    return null;
  }

  const withoutPhasePrefix = normalized[0].toLowerCase() === 'phase roadmap'
    ? normalized.slice(1)
    : normalized;
  if (withoutPhasePrefix.length === 0) return null;

  // We intentionally map from the deepest segment first so nested checklist items
  // become concrete capability leaves instead of inheriting process/stage labels.
  for (let index = withoutPhasePrefix.length - 1; index >= 0; index -= 1) {
    const mapped = map3DImplementationEntryToCapability(withoutPhasePrefix[index]);
    if (!mapped) continue;
    return mapped
      .split('>')
      .map((segment) => segment.trim())
      .filter(Boolean);
  }

  // Keep already-capability-shaped labels and drop remaining process-only wrappers.
  if (withoutPhasePrefix[0].toLowerCase() === 'world map') return withoutPhasePrefix;
  if (is3DPlanningMetaSegment(withoutPhasePrefix[0]) || is3DUmbrellaGroupingSegment(withoutPhasePrefix[0])) return null;

  return null;
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
    const worldMapSegments = [...preferredSegments];
    // Keep one canonical family name for map appearance work.
    if (worldMapSegments[1]?.toLowerCase() === 'visuals') {
      worldMapSegments[1] = 'Rendering';
    }
    return worldMapSegments.join(' > ');
  }

  return `${featureName} > ${preferredSegments.join(' > ')}`;
};

export const summarizeDocs = (docsList: string[]) => docsList.join(' | ');
