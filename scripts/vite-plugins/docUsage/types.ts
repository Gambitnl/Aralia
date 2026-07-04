export interface DocFacts {
  path: string;                    // repo-relative, forward slashes
  contentHash: string;             // sha256 hex of content with CRLF normalized to LF
  wordCount: number;
  openTaskCount: number;           // count of unchecked "- [ ]" list items
  supersededBy: string | null;     // first "superseded by X" / "see X instead" target, else null
  outboundLinkTargets: string[];   // .md targets THIS doc links to (md links + wikilinks), repo-relative-ish
  lifecycleStatus: string | null;  // frontmatter status in {done,retired,archived,superseded} OR "renamed-retired" for ~.md files
  mtimeMs: number;
}

export type RefKind = 'file' | 'dir' | 'data' | 'build';

export interface ReferenceIndex {
  fileRefs: Map<string, Set<string>>;      // exact repo-rel path -> app labels
  basenameRefs: Map<string, Set<string>>;  // basename (e.g. "foo.md") -> app labels
  dirRefs: Array<{ prefix: string; app: string }>; // templated dir prefixes ("docs/x/y/")
  dataRefs: Map<string, Set<string>>;      // path found in a data/config file -> app labels
  buildRefs: Set<string>;                  // paths referenced by build entries
  diagnostics: { ambiguousRefs: string[]; unresolvedRefs: string[] };
}

export interface Candidate {
  isCandidate: boolean;
  reasons: string[];
  confidence: 'authoritative' | 'high' | 'low' | 'none';
}

export interface DocUsageEntry {
  path: string;
  consumedBy: string[];
  consumedVia: RefKind | null;
  contentHash: string;
  duplicateGroupId: number | null;
  role: string | null;
  ageDays: number;
  gitAgeDays: number | null;
  wordCount: number;
  openTaskCount: number;
  inboundLinks: number;
  lifecycle: string | null;
  supersededBy: string | null;
  candidate: Candidate;
}

export interface DocUsagePayload {
  generatedAt: string;
  docs: DocUsageEntry[];
  diagnostics: { ambiguousRefs: string[]; unresolvedRefs: string[]; atlasMissing: boolean };
}
