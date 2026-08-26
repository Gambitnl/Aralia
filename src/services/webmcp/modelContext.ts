/**
 * The ONLY file in Aralia that names the browser's WebMCP entry point.
 *
 * WHY THIS EXISTS. The standard is a community draft, not a finished web
 * standard, and it has already renamed its entry point once: the getter moved
 * from `navigator.modelContext` to `document.modelContext` on 2026-05-27, and
 * Chromium removes the old name in version 150. Every other file goes through
 * this wrapper, so the next rename is a one-line fix here instead of a sweep
 * across every surface.
 *
 * NEVER write `navigator.modelContext` anywhere, including here.
 *
 * NO FALLBACK. When the browser has no WebMCP support this fails loudly and
 * says exactly what is missing. It does not quietly pretend to register tools,
 * because a silent no-op looks identical to a working page and wastes an
 * afternoon proving otherwise.
 */

import type { AraliaTool, SurfaceId, ToolResult } from './types';
import { recordCall } from './toolLog';

/** The subset of the draft we use. Named locally so the spec's own shape
 *  changing does not spread past this file. */
interface SpecTool {
  name: string;
  description: string;
  title?: string;
  inputSchema?: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute: (input: Record<string, unknown>) => Promise<unknown>;
}

interface SpecModelContext {
  registerTool: (tool: SpecTool, options?: Record<string, unknown>) => unknown;
  getTools?: (options?: Record<string, unknown>) => unknown;
  executeTool?: (name: string, input: Record<string, unknown>) => Promise<unknown>;
}

/** Why the browser cannot run WebMCP, in words a person can act on. */
export type SupportProblem = 'no-document' | 'no-model-context' | 'no-register';

export interface SupportReport {
  supported: boolean;
  problem?: SupportProblem;
  /** What to tell the reader. Empty when supported. */
  message: string;
}

/** The one place `document.modelContext` is read. */
function readModelContext(): SpecModelContext | undefined {
  if (typeof document === 'undefined') return undefined;
  return (document as unknown as { modelContext?: SpecModelContext }).modelContext;
}

/**
 * Can this browser run WebMCP right now? Call before registering, and show
 * the message rather than failing silently.
 */
export function checkSupport(): SupportReport {
  if (typeof document === 'undefined') {
    return {
      supported: false,
      problem: 'no-document',
      message: 'No document. WebMCP needs a real browser page, not a server or a worker.',
    };
  }
  const mc = readModelContext();
  if (!mc) {
    return {
      supported: false,
      problem: 'no-model-context',
      message:
        'This browser has no document.modelContext. Use Chrome 149 or later and turn on '
        + 'chrome://flags/#enable-webmcp-testing. WebMCP also needs HTTPS or localhost.',
    };
  }
  if (typeof mc.registerTool !== 'function') {
    return {
      supported: false,
      problem: 'no-register',
      message:
        'document.modelContext exists but has no registerTool. The browser build is older '
        + 'than the current draft.',
    };
  }
  return { supported: true, message: '' };
}

/** Thrown when registration is attempted on a browser that cannot do it. */
export class WebMcpUnsupportedError extends Error {
  readonly problem: SupportProblem;
  constructor(report: SupportReport) {
    super(report.message);
    this.name = 'WebMcpUnsupportedError';
    this.problem = report.problem ?? 'no-model-context';
  }
}

/** The spec's own name limits: 1 to 128 chars, letters, digits, . _ - */
const NAME_RULE = /^[A-Za-z0-9._-]{1,128}$/;

/**
 * Call one tool, timed and logged. THE ONLY PATH A TOOL IS EVER CALLED BY.
 *
 * Both callers go through here: the browser, via the wrapper registerTool
 * installs, and the test page's Run buttons. That matters. The first version
 * had the test page call `tool.execute` directly, so pressing Run proved the
 * tool but wrote nothing to the log — and since no agent calls WebMCP tools
 * yet, the log could never fill at all. It was empty on a page whose whole
 * job is to show it. Found by clicking Run and looking, not by a test.
 */
export async function callTool(
  tool: AraliaTool,
  surface: SurfaceId,
  input: Record<string, unknown> = {},
): Promise<ToolResult> {
  const started = Date.now();
  try {
    const result: ToolResult = await tool.execute(input ?? {});
    recordCall({
      tool: tool.name,
      surface,
      kind: tool.kind,
      input: input ?? {},
      ms: Date.now() - started,
      outcome: result.isError ? 'error' : 'ok',
      detail: result.text,
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordCall({
      tool: tool.name,
      surface,
      kind: tool.kind,
      input: input ?? {},
      ms: Date.now() - started,
      outcome: 'error',
      detail: message,
    });
    return { text: message, isError: true };
  }
}

/** Adapt callTool to the shape the spec hands the browser. */
function instrument(tool: AraliaTool, surface: SurfaceId) {
  return async (input: Record<string, unknown> = {}) => {
    const result = await callTool(tool, surface, input);
    return {
      content: [{ type: 'text', text: result.text }],
      structuredContent: result.data,
      isError: result.isError === true,
    };
  };
}

/**
 * Register one tool with the browser. Throws when the browser cannot, and
 * throws when the name breaks the spec's rule — both are author mistakes that
 * must surface at once rather than at call time.
 */
export function registerTool(tool: AraliaTool, surface: SurfaceId): void {
  const support = checkSupport();
  if (!support.supported) throw new WebMcpUnsupportedError(support);

  if (!NAME_RULE.test(tool.name)) {
    throw new Error(
      `Tool name "${tool.name}" breaks the WebMCP rule: 1 to 128 characters, `
      + 'letters, digits, period, underscore, hyphen only.',
    );
  }

  const mc = readModelContext();
  if (!mc) throw new WebMcpUnsupportedError(support);

  mc.registerTool({
    name: tool.name,
    description: tool.description,
    title: tool.title,
    inputSchema: tool.inputSchema,
    annotations: {
      readOnlyHint: tool.kind === 'read',
      // Remy's answer to the poisoning question: mark the risky tools.
      untrustedContentHint: tool.returnsPersonText === true,
    },
    execute: instrument(tool, surface),
  });
}
