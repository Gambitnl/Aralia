/** Experimental transport candidate, deliberately NOT used by the live worker.
 * Benchmarks reduced browser decode time but added too much worker encoding
 * time, worsening the already slow physical pace. Retained for investigation.
 * Carries the same waterfall snapshot with less browser object-decoding work.
 * Most records travel as JSON text. Values JSON would change, shared references
 * and prepared typed buffers travel separately and are restored before display.
 * This changes transport only: it neither advances nor simplifies the solver.
 * Unusual future record types retain the browser's ordinary structured clone. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 13/10/2026, 02:15:05
 * Dependents: None (Orphan)
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

type Path = string[];
type Link = { parent: Link | null; key: string };
type Repair = { path: Path; kind: 'value'; value: unknown }
  | { path: Path; kind: 'reference'; target: Path }
  | { path: Path; kind: 'hole' };
export type WaterfallSnapshotTransfer<T> = { format: 'waterfall-json-v1'; json: string; repairs: Repair[] }
  | { format: 'waterfall-structured-v1'; value: T };

export function encodeWaterfallSnapshot<T>(value: T): WaterfallSnapshotTransfer<T> {
  const seen = new WeakMap<object, Link | null>();
  const repairs: Repair[] = [];
  const unsupported = {};
  const pathOf = (link: Link | null): Path => {
    const path: Path = [];
    for (let next = link; next; next = next.parent) path.push(next.key);
    return path.reverse();
  };
  // A JSON replacer runs a JS callback for every scalar and proved too costly
  // in the worker. This walk allocates paths only for objects/special values;
  // ordinary subtrees go straight to the engine's fast JSON encoder.
  const visit = (raw: unknown, parent: Link | null, key?: string): unknown => {
      const type = typeof raw;
      // Ordinary scalars need no path allocation or repair.
      if (raw === null || type === 'string' || type === 'boolean'
        || (type === 'number' && Number.isFinite(raw) && !Object.is(raw, -0))) return raw;
      const link: Link | null = key === undefined ? null : { parent, key };
      if (type === 'undefined' || type === 'number' || type === 'bigint') {
        repairs.push({ path: pathOf(link), kind: 'value', value: raw });
        return type === 'bigint' ? null : raw;
      }
      if (type !== 'object') throw unsupported;
      const object = raw as object;
      if (seen.has(object)) {
        repairs.push({ path: pathOf(link), kind: 'reference', target: pathOf(seen.get(object)!) });
        return null;
      }
      seen.set(object, link);
      // The prepared Float32 geometry stays transferable rather than becoming
      // text. Other views keep their native type and shared buffer identity too.
      if (ArrayBuffer.isView(object) || object instanceof ArrayBuffer) {
        repairs.push({ path: pathOf(link), kind: 'value', value: object });
        return null;
      }
      const prototype = Object.getPrototypeOf(object);
      if (prototype !== Object.prototype && prototype !== null && prototype !== Array.prototype) throw unsupported;
      // JSON ignores extra array properties. Keep such a future record on the
      // ordinary clone path instead of silently losing diagnostic information.
      const keys = Object.keys(object);
      if (Array.isArray(object) && keys.some(k => String(Number(k)) !== k || Number(k) >= object.length || Number(k) < 0 || !Number.isInteger(Number(k)))) throw unsupported;
      let copy: Record<string, unknown> | unknown[] | null = null;
      for (const name of keys) {
        const original = (object as Record<string, unknown>)[name];
        const child = visit(original, link, name);
        if (!Object.is(child, original)) {
          copy ??= Array.isArray(object) ? object.slice() : { ...object };
          Object.defineProperty(copy, name, { value: child, enumerable: true, writable: true, configurable: true });
        }
      }
      if (Array.isArray(object) && keys.length < object.length) {
        for (let index = 0; index < object.length; index++) {
          if (!Object.prototype.hasOwnProperty.call(object, index)) repairs.push({ path: pathOf({parent: link, key: String(index)}), kind: 'hole' });
        }
      }
      return copy ?? object;
  };
  try {
    const projected = visit(value, null);
    // A special root still needs a valid JSON document for its repair to apply.
    const json = JSON.stringify(projected) ?? 'null';
    return { format: 'waterfall-json-v1', json, repairs };
  } catch (error) {
    if (error !== unsupported) throw error;
    return { format: 'waterfall-structured-v1', value };
  }
}

export function decodeWaterfallSnapshot<T>(packet: WaterfallSnapshotTransfer<T>): T {
  if (packet.format === 'waterfall-structured-v1') return packet.value;
  if (packet.format !== 'waterfall-json-v1') throw Error('Unknown waterfall snapshot transport');
  let result: unknown = JSON.parse(packet.json);
  const at = (path: Path): unknown => path.reduce<unknown>((parent, key) => (parent as Record<string, unknown>)[key], result);
  for (const repair of packet.repairs) {
    const value = repair.kind === 'reference' ? at(repair.target) : repair.kind === 'value' ? repair.value : undefined;
    if (!repair.path.length) { result = value; continue; }
    const parent = at(repair.path.slice(0, -1)) as Record<string, unknown>;
    const key = repair.path[repair.path.length - 1];
    if (repair.kind === 'hole') delete parent[key];
    // defineProperty preserves an own __proto__ key without changing the
    // receiver's prototype, and keeps explicit undefined different from absent.
    else Object.defineProperty(parent, key, { value, enumerable: true, configurable: true, writable: true });
  }
  return result as T;
}
