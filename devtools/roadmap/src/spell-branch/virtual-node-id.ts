import type { AxisChoice, AxisId } from './types';

// ============================================================================
// Encoding helpers
// ============================================================================
// Technical: encode AxisChoice[] as a sorted "k=v:k=v" segment for use in IDs.
// Layman: turns a list of filter picks into a stable string key.
// ============================================================================
function encodeChoices(choices: AxisChoice[]): string {
  return [...choices]
    .sort((a, b) => a.axisId.localeCompare(b.axisId))
    .map((c) => `${c.axisId}=${c.value}`)
    .join(':');
}

/**
 * ID for a top-level axis node (no prior choices).
 * If choices are provided, this is a nested axis node appearing after value picks.
 */
export function axisNodeId(axisId: AxisId, choices: AxisChoice[] = []): string {
  if (choices.length === 0) return `$spell:axis:${axisId}`;
  return `$spell:v:${encodeChoices(choices)}:axis:${axisId}`;
}

/**
 * ID for a value node — encodes the full set of choices that led here.
 */
export function valueNodeId(choices: AxisChoice[]): string {
  return `$spell:v:${encodeChoices(choices)}`;
}

/**
 * ID for the "Show Spells" node under a given choice path.
 */
export function showSpellsNodeId(choices: AxisChoice[]): string {
  return `$spell:v:${encodeChoices(choices)}:show`;
}

/**
 * ID for a spell entry node under a given choice path.
 */
export function entryNodeId(choices: AxisChoice[], spellId: string): string {
  return `$spell:v:${encodeChoices(choices)}:entry:${spellId}`;
}

// ============================================================================
// Detection
// ============================================================================
export function isVirtualNodeId(id: string): boolean {
  return id.startsWith('$spell:');
}

// ============================================================================
// Parsing
// ============================================================================
export type ParsedVirtualNode =
  | { kind: 'axis'; axisId: string; choices: AxisChoice[] }
  | { kind: 'value'; choices: AxisChoice[] }
  | { kind: 'show-spells'; choices: AxisChoice[] }
  | { kind: 'entry'; spellId: string; choices: AxisChoice[] };

function parseChoiceSegment(segment: string): AxisChoice[] {
  if (!segment) return [];
  return segment.split(':').map((pair) => {
    const eq = pair.indexOf('=');
    return { axisId: pair.slice(0, eq) as AxisId, value: pair.slice(eq + 1) };
  });
}

export function parseVirtualNodeId(id: string): ParsedVirtualNode | null {
  if (!isVirtualNodeId(id)) return null;

  // Top-level axis: "$spell:axis:{axisId}"
  const axisTopMatch = id.match(/^\$spell:axis:(.+)$/);
  if (axisTopMatch) {
    return { kind: 'axis', axisId: axisTopMatch[1], choices: [] };
  }

  // Value path: "$spell:v:{choices}" optionally followed by :axis:{id}, :show, or :entry:{id}
  const vMatch = id.match(/^\$spell:v:(.+)$/);
  if (!vMatch) return null;
  const rest = vMatch[1];

  // Nested axis: ends with ":axis:{axisId}"
  const nestedAxisMatch = rest.match(/^(.+):axis:([^:]+)$/);
  if (nestedAxisMatch) {
    return { kind: 'axis', axisId: nestedAxisMatch[2], choices: parseChoiceSegment(nestedAxisMatch[1]) };
  }

  // Show spells: ends with ":show"
  const showMatch = rest.match(/^(.+):show$/);
  if (showMatch) {
    return { kind: 'show-spells', choices: parseChoiceSegment(showMatch[1]) };
  }

  // Entry: ends with ":entry:{spellId}"
  const entryMatch = rest.match(/^(.+):entry:([^:]+)$/);
  if (entryMatch) {
    return { kind: 'entry', spellId: entryMatch[2], choices: parseChoiceSegment(entryMatch[1]) };
  }

  // Plain value node: the rest is the choice segment
  return { kind: 'value', choices: parseChoiceSegment(rest) };
}

/**
 * Extracts choices from any virtual node ID.
 * Returns [] for top-level axis nodes (no prior choices).
 */
export function choicesFromVirtualNodeId(id: string): AxisChoice[] {
  const parsed = parseVirtualNodeId(id);
  if (!parsed) return [];
  return parsed.choices;
}
