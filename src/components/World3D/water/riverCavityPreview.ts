/**
 * Loads bounded, stored bank-cavity observations for the cloned river page.
 * These are historical native triangles, never a running physical simulation.
 * The owning experiment writes the ignored files; this viewer only reads them.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 10/10/2026, 13:35:46
 * Dependents: components/World3D/water/RiverCavityPreviewPanel.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export interface CavityObservation { label: string; timeSeconds: number; stateId: string; positions: number[] }
export interface CavityPreviewData {
  status: string; message: string; nativeGeometryIdentity: string;
  terrain: number[]; snapshots: CavityObservation[];
}
const ROOT = `${import.meta.env.BASE_URL}.agent/scratch/waterfall-gauntlet/river-inspection-preview/`;
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid experiment record');
  return value as Record<string, unknown>;
}
function words(value: unknown): string { return typeof value === 'string' ? value : ''; }
function triangles(value: unknown): number[] {
  if (!Array.isArray(value) || value.length > 180000 || value.length % 9 !== 0 || !value.every(v => typeof v === 'number' && Number.isFinite(v))) throw new Error('Invalid or oversized native triangles');
  return value as number[];
}
async function read(name: string, signal: AbortSignal): Promise<Record<string, unknown>> {
  // Only the two declared local files can be selected by the manifest.
  const response = await fetch(`${ROOT}${name}?reload=${Date.now()}`, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error(`${name} unavailable (${response.status})`);
  const source = await response.text();
  if (source.length > 24000000) throw new Error('Experiment file exceeds the inspection limit');
  return record(JSON.parse(source));
}
export async function loadCavityPreview(signal: AbortSignal): Promise<CavityPreviewData> {
  const manifest = await read('preview-manifest.json', signal);
  if (manifest.version !== 1 || manifest.terrainFile !== 'frozen-terrain.json' || manifest.resultFile !== 'cavity-result.json') throw new Error('Unsupported experiment manifest');
  const terrain = await read('frozen-terrain.json', signal);
  const result = await read('cavity-result.json', signal);
  const identity = words(terrain.nativeGeometryIdentity);
  if (!identity || result.nativeGeometryIdentity !== identity) throw new Error('Frozen terrain and result identities do not match');
  const snapshots = result.snapshots;
  if (!Array.isArray(snapshots) || snapshots.length > 64) throw new Error('Invalid observation inventory');
  return { status: words(result.status) || words(manifest.status), message: words(result.message) || words(manifest.message), nativeGeometryIdentity: identity,
    terrain: triangles(terrain.positions), snapshots: snapshots.map(item => {
      const frame = record(item);
      if (typeof frame.timeSeconds !== 'number' || !Number.isFinite(frame.timeSeconds)) throw new Error('Invalid stored observation time');
      // Each observation must carry its own provenance. A matching result
      // envelope alone cannot prove that an accidentally mixed frame belongs.
      if (frame.nativeGeometryIdentity !== identity || !words(frame.stateId).trim() || !words(frame.label).trim()) throw new Error('Stored observation provenance is missing or does not match frozen terrain');
      return { label: words(frame.label), stateId: words(frame.stateId), timeSeconds: frame.timeSeconds, positions: triangles(frame.positions) };
    }) };
}
