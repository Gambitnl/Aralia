/**
 * Shared types for the WebMCP tool layer.
 *
 * WebMCP is a browser API that lets a page hand an AI agent a list of callable
 * tools, instead of making the agent read pixels and guess at the DOM. The
 * page is the tool provider; the browser or the agent is the caller.
 *
 * STATUS OF THE STANDARD (checked 2026-08-30): a Draft Community Group Report
 * from the W3C Web Machine Learning Community Group, dated 2026-08-26. It is
 * NOT a W3C standard and NOT on the Recommendation track. Chrome runs a public
 * origin trial from version 149 to 156. No mainstream agent calls these tools
 * yet. Expect the shape to move again.
 *
 * THE ENTRY POINT IS `document.modelContext`, NEVER `navigator.modelContext`.
 * The draft moved the getter from Navigator to Document on 2026-05-27, and
 * Chromium removes the old name in 150. Only `modelContext.ts` may name it.
 */

/** A JSON Schema object describing one tool's input. */
export type ToolInputSchema = Record<string, unknown>;

/**
 * What a tool hands back. The spec passes results as content blocks; we keep
 * a plain shape here and let the wrapper translate, so a change to the spec's
 * result format does not reach the tools themselves.
 */
export interface ToolResult {
  /** Human-readable text. This is what an agent reads. */
  text: string;
  /** Optional structured payload, for a tool whose answer is data. */
  data?: unknown;
  /** True when the call failed. The log counts these separately. */
  isError?: boolean;
}

/** Where a tool sits in Aralia. One of the four surfaces Remy chose. */
export type SurfaceId = 'design-preview' | 'planmap' | 'devpages' | 'game';

/**
 * What a tool does to the page. Read tools cannot break anything; act tools
 * can. The log groups by this, and the test page shows it, so a tool that
 * changes state is never mistaken for one that only looks.
 */
export type ToolKind = 'read' | 'navigate' | 'act';

/** One tool, as a feature declares it. */
export interface AraliaTool {
  /**
   * Unique across the whole app. The spec allows 1 to 128 characters of
   * letters, digits, hyphen, underscore, and period. We use
   * `<surface>.<verb><Noun>`, so a name says where it lives.
   */
  name: string;
  /** One sentence an agent reads to decide whether to call this. */
  description: string;
  /** Short label for a person reading the test page. */
  title?: string;
  /** JSON Schema for the input. Omit for a tool that takes nothing. */
  inputSchema?: ToolInputSchema;
  /** read, navigate, or act. */
  kind: ToolKind;
  /**
   * True when the result can contain text a person typed — a character name,
   * a chronicle entry, a note. The wrapper then sets the spec's
   * untrustedContentHint, so an agent knows not to read it as an instruction.
   *
   * This is Remy's answer to the tool-poisoning question: mark the risky
   * tools, do not add a confirm step. The marker is a hint, not a defense.
   */
  returnsPersonText?: boolean;
  /** Does the work. Receives the parsed input; returns what the agent reads. */
  execute: (input: Record<string, unknown>) => Promise<ToolResult> | ToolResult;
}

/** A group of tools belonging to one surface. */
export interface SurfaceTools {
  surface: SurfaceId;
  /** Shown on the test page and in the log. */
  label: string;
  tools: AraliaTool[];
}

/** One entry in the tool log. */
export interface ToolLogEntry {
  /** Rises by one per call, so the panel can order calls that share a clock tick. */
  seq: number;
  at: string;
  tool: string;
  surface: SurfaceId | 'unknown';
  kind: ToolKind | 'unknown';
  input: Record<string, unknown>;
  /** How long execute took, in milliseconds. */
  ms: number;
  outcome: 'ok' | 'error' | 'refused';
  /** The result text, or the failure message. Trimmed for the panel. */
  detail: string;
}

/** The running count the log keeps per tool, across a browser session. */
export interface ToolCount {
  tool: string;
  calls: number;
  errors: number;
  refusals: number;
  /** Mean duration in milliseconds, over successful calls. */
  avgMs: number;
  lastAt: string;
}
