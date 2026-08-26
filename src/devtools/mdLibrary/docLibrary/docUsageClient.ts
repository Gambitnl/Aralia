export interface DocUsage {
  path: string; consumedBy: string[]; consumedVia: 'file'|'dir'|'data'|'build'|null;
  duplicateGroupId: number|null; role: string|null; ageDays: number; gitAgeDays: number|null;
  wordCount: number; openTaskCount: number; inboundLinks: number;
  lifecycle: string|null; supersededBy: string|null;
  candidate: { isCandidate: boolean; reasons: string[]; confidence: 'authoritative'|'high'|'low'|'none' };
}
export interface DocUsageResponse {
  generatedAt: string; docs: DocUsage[];
  diagnostics: { ambiguousRefs: string[]; unresolvedRefs: string[]; atlasMissing: boolean };
}
export function indexByPath(docs: DocUsage[]): Record<string, DocUsage> {
  const out: Record<string, DocUsage> = {};
  for (const d of docs) out[d.path] = d;
  return out;
}
export async function fetchDocUsage(refresh = false): Promise<DocUsageResponse> {
  const res = await fetch(`/api/docs/usage${refresh ? '?refresh=1' : ''}`);
  if (!res.ok) throw new Error(`doc usage load failed (${res.status})`);
  return res.json();
}
