import { useEffect, useMemo, useState } from "react";
import { GlossaryEntry } from "../types";
import level1GapsMd from "../../docs/tasks/spell-system-overhaul/gaps/LEVEL-1-GAPS.md?raw";
import cantripGapsMd from "../../docs/tasks/spell-system-overhaul/1I-MIGRATE-CANTRIPS-BATCH-1.md?raw";
import { fetchWithTimeout } from "../utils/networkUtils";

const normalizeId = (raw: string): string =>
  raw
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export type GateStatus = "pass" | "gap" | "fail";

export interface LayoutChecks {
  hasSpellCard: boolean;
  hasHeader: boolean;
  hasStatsGrid: boolean;
  hasDescription: boolean;
  hasTagsSection: boolean;
  usesMarkdownFormat: boolean; // Detects incorrect ## or - **bold:** markdown format
}

export interface GateChecklist {
  manifestPathOk: boolean;
  glossaryExists: boolean;
  levelTagOk: boolean;
  layoutOk: boolean;
  knownGap: boolean;
}

export interface GateResult {
  status: GateStatus;
  reasons: string[];
  level?: number;
  checklist: GateChecklist;
  layout?: LayoutChecks;
}

const extractIdsFromMarkdown = (md: string): Set<string> => {
  const ids = new Set<string>();

  // Bolded spell names: **Spell Name**
  const boldRegex = /\*\*(.+?)\*\*/g;
  let match: RegExpExecArray | null;
  while ((match = boldRegex.exec(md)) !== null) {
    ids.add(normalizeId(match[1]));
  }

  // Inline code identifiers: `spell-id`
  const codeRegex = /`([^`]+?)`/g;
  while ((match = codeRegex.exec(md)) !== null) {
    ids.add(normalizeId(match[1]));
  }

  return ids;
};

const buildKnownGapSet = (): Set<string> => {
  const set = new Set<string>();
  extractIdsFromMarkdown(level1GapsMd).forEach(id => set.add(id));
  extractIdsFromMarkdown(cantripGapsMd).forEach(id => set.add(id));
  return set;
};

const fetchGlossaryCard = async (id: string, level: number, signal?: AbortSignal) => {
  const url = `${import.meta.env.BASE_URL}data/glossary/entries/spells/level-${level}/${id}.md`;
  try {
    return await fetchWithTimeout<string>(url, { responseType: 'text', signal });
  } catch {
    return null;
  }
};

const parseFrontmatter = (raw: string) => {
  const fmMatch = /^---\s*([\s\S]*?)\s*---/m.exec(raw);
  if (!fmMatch) return null;
  const block = fmMatch[1];
  const tagsMatch = /tags:\s*\[(.*?)\]/s.exec(block);
  const idMatch = /id:\s*["']?([a-z0-9\-_]+)["']?/i.exec(block);
  const tags = tagsMatch
    ? tagsMatch[1]
      .split(",")
      .map(t => t.trim().replace(/['"]/g, ""))
      .filter(Boolean)
    : [];
  const id = idMatch ? idMatch[1] : null;
  return { id, tags };
};

export const useSpellGateChecks = (entries: GlossaryEntry[] | null) => {
  const [results, setResults] = useState<Record<string, GateResult>>({});

  const knownGaps = useMemo(buildKnownGapSet, []);
  const entryMap = useMemo(() => {
    const map = new Map<string, GlossaryEntry>();
    (entries || []).forEach(e => map.set(e.id, e));
    return map;
  }, [entries]);

  useEffect(() => {
    if (!entries) return;
    const controller = new AbortController();

    const run = async () => {
      try {
        const manifest = await fetchWithTimeout<Record<string, any>>(
          `${import.meta.env.BASE_URL}data/spells_manifest.json`,
          { signal: controller.signal }
        );

        const next: Record<string, GateResult> = {};
        await Promise.all(Object.entries(manifest).map(async ([id, data]) => {
          if (controller.signal.aborted) return;

          const level = data.level;
          if (typeof level !== "number") return;

          const checklist: GateChecklist = {
            manifestPathOk: false,
            glossaryExists: false,
            levelTagOk: false,
            layoutOk: false,
            knownGap: knownGaps.has(id),
          };
          const reasons: string[] = [];
          let status: GateStatus = "pass";

          if (data.path && data.path.includes(`/level-${level}/`)) {
            checklist.manifestPathOk = true;
          } else {
            status = "fail";
            reasons.push("Path not in expected level folder");
          }

          let tags: string[] = [];
          let cardFound = false;
          let cardContent: string | null = null;

          // Always fetch the card content to check layout
          cardContent = await fetchGlossaryCard(id, level, controller.signal);

          if (cardContent) {
            cardFound = true;
            const fm = parseFrontmatter(cardContent);
            if (fm?.id && normalizeId(fm.id) === id) {
              tags = (fm.tags || []).map(t => t.toLowerCase());
            }
          } else {
            // Fallback to context entry for tags if fetch failed
            const entry = entryMap.get(id);
            if (entry) {
              cardFound = true;
              tags = entry.tags?.map(t => t.toLowerCase()) || [];
            }
          }

          if (cardFound) {
            checklist.glossaryExists = true;
          } else {
            status = "fail";
            reasons.push("No glossary card found");
          }

          // Check for correct spell-card HTML layout
          if (cardContent && cardContent.includes('<div class="spell-card">') && cardContent.includes('spell-card-stats-grid')) {
            checklist.layoutOk = true;
          } else if (cardFound) {
            status = "fail";
            reasons.push("Incorrect layout (missing spell-card HTML)");
          }

          const levelTag = `level ${level}`;
          const levelTagAlt = `level-${level}`;
          if (tags.some(t => t === levelTag || t === levelTagAlt || t === `level${level}`)) {
            checklist.levelTagOk = true;
          } else {
            status = "fail";
            reasons.push("Missing level tag in glossary card");
          }

          if (checklist.knownGap) {
            if (status === "pass") status = "gap";
            reasons.push("Known schema gap (see gap log)");
          }

          next[id] = { status, reasons, level, checklist };
        }));

        if (!controller.signal.aborted) {
          setResults(next);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error("Spell gate check failed:", err);
          setResults({});
        }
      }
    };

    run();
    return () => controller.abort();
  }, [entries, entryMap, knownGaps]);

  return results;
};
