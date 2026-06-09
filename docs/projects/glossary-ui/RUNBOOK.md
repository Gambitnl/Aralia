# Glossary UI Runbook

Status: active
Last updated: 2026-06-09

## Glossary Rebuild Pipeline

The glossary system uses a three-stage pipeline to go from vendor source data
to a runtime-consumable bundle. The UI reads only the final bundle at runtime.

### Stage 1: Ingest (source -> entry files)

Script: `scripts/ingestPhbGlossary.ts`
Command: `npx tsx scripts/ingestPhbGlossary.ts`
Input: `vendor/5etools-src/data/*.json` (items, feats, backgrounds, skills, etc.)
Output: individual JSON files under `public/data/glossary/entries/<category>/`

This stage reads 5eTools vendor data and writes one JSON file per glossary entry.
It only needs to run when upstream vendor data changes or new source categories
are added. Most iterations will not need this step.

### Stage 2: Index (entry files -> category indices)

Script: `scripts/generateGlossaryIndex.js`
Command: `node scripts/generateGlossaryIndex.js`
Input: `public/data/glossary/entries/**/*.json` + `public/data/spells_manifest.json`
Output: `public/data/glossary/index/*.json` + `public/data/glossary/index/main.json`

This stage scans all entry files, groups them by category (with special logic
for Character Classes, Character Races, Equipment, and Spells), and writes
per-category index files. It also writes `main.json` which lists all category
index files. This must run whenever entries are added, removed, or changed.

Dev-server shortcut: `POST /api/glossary/rebuild-index` triggers this via the
`glossaryIndexManager` Vite plugin (defined in
`scripts/vite-plugins/miscManagers.ts`).

### Stage 3: Bundle (category indices -> single bundle)

Script: `scripts/bundle-static-data.ts`
Command: `npx tsx scripts/bundle-static-data.ts`
Input: `public/data/glossary/index/main.json` -> reads each listed category index
Output: `public/data/glossary_bundle.json`

This stage reads the main index, collects all category index files, deduplicates
by entry ID, and writes a single flat JSON array. The runtime `GlossaryContext`
reads only this file.

## Existing npm Scripts

| Script | Command | What it does |
|---|---|---|
| `glossary:rebuild` | `tsx scripts/ingestPhbGlossary.ts && node scripts/generateGlossaryIndex.js && tsx scripts/bundle-static-data.ts` | Runs the full glossary pipeline (Stages 1-3). |
| `build:data` | `tsx scripts/generateItemRegistry.ts && npm run glossary:rebuild` | Runs item registry plus the full glossary pipeline. |
| `build` | `npm run build:data && rimraf dist && vite build` | Full production build. Bundles and now refreshes the glossary pipeline before the app build. |

## Resolved Contract: Named Full-Pipeline Command

The glossary rebuild now has a dedicated non-dev command: `npm run
glossary:rebuild`. Use it when glossary source files change and you need the
entries, indices, and bundle refreshed together.

`npm run build:data` still exists as the broader data build entry point and now
delegates to the glossary rebuild after item registry generation.

## Verification

After any rebuild, check:

1. `public/data/glossary/index/main.json` has a recent `lastGenerated` timestamp.
2. `public/data/glossary_bundle.json` exists and is non-empty.
3. The bundle hash is stable across clean reruns unless the inputs changed.
4. If the dev server is running, the glossary modal loads and shows entries.

Quick hash check (PowerShell):
```powershell
(Get-FileHash public/data/glossary_bundle.json -Algorithm SHA256).Hash
```

## File Map

| File | Role |
|---|---|
| `package.json` | Named entry points for rebuild and data pipeline |
| `scripts/ingestPhbGlossary.ts` | Stage 1: vendor -> entry JSON files |
| `scripts/generateGlossaryIndex.js` | Stage 2: entry files -> category indices |
| `scripts/bundle-static-data.ts` | Stage 3: indices -> single bundle |
| `scripts/generateItemRegistry.ts` | Item registry (runs before bundle in `build:data`) |
| `scripts/vite-plugins/miscManagers.ts` | Dev-server API for index rebuild |
| `public/data/glossary/entries/` | Individual glossary entry JSON files |
| `public/data/glossary/index/` | Generated category index files + main.json |
| `public/data/glossary_bundle.json` | Final runtime bundle (read by GlossaryContext) |
| `src/context/GlossaryContext.tsx` | Runtime consumer of the bundle |
