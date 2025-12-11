import { useEffect, useMemo, useState } from "react";
import { GlossaryEntry } from "../types";
import { env } from '@/config/env';
import level1GapsMd from "../../docs/tasks/spell-system-overhaul/gaps/LEVEL-1-GAPS.md?raw";
import cantripGapsMd from "../../docs/tasks/spell-system-overhaul/1I-MIGRATE-CANTRIPS-BATCH-1.md?raw";

const normalizeId = (raw: string): string =>
  raw
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export type GateStatus = "pass" | "gap" | "fail";

export interface GateChecklist {
  manifestPathOk: boolean;
  glossaryExists: boolean;
  levelTagOk: boolean;
  knownGap: boolean;
}

export interface GateResult {
  status: GateStatus;
  reasons: string[];
  level?: number;
  checklist: GateChecklist;
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

const fetchGlossaryCard = async (id: string) => {
  const url = `${env.APP.BASE_URL}data/glossary/entries/spells/${id}.md`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.text();
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

    const run = async () => {
      try {
        const res = await fetch(`${env.APP.BASE_URL}data/spells_manifest.json`);
        if (!res.ok) throw new Error(`Failed to load spells_manifest.json: ${res.statusText}`);
        const manifest = await res.json();

        const next: Record<string, GateResult> = {};
        await Promise.all(Object.entries<any>(manifest).map(async ([id, data]) => {
          const level = data.level;
          if (typeof level !== "number") return;

          const checklist: GateChecklist = {
            manifestPathOk: false,
            glossaryExists: false,
            levelTagOk: false,
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

          // Prefer context entry, but fall back to fetching the markdown directly
          const entry = entryMap.get(id);
          if (entry) {
            cardFound = true;
            tags = entry.tags?.map(t => t.toLowerCase()) || [];
          } else {
            const card = await fetchGlossaryCard(id);
            if (card) {
              cardFound = true;
              const fm = parseFrontmatter(card);
              if (fm?.id && normalizeId(fm.id) === id) {
                tags = (fm.tags || []).map(t => t.toLowerCase());
              }
            }
          }

          if (cardFound) {
            checklist.glossaryExists = true;
          } else {
            status = "fail";
            reasons.push("No glossary card found");
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

        setResults(next);
      } catch (err) {
        console.error("Spell gate check failed:", err);
        setResults({});
      }
    };

    run();
  }, [entries, entryMap, knownGaps]);

  return results;
};
