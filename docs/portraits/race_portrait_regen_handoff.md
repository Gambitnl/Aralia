# Race Portrait Regen (Gemini) Handoff

Updated: 2026-02-11 (local) / 2026-02-10 (UTC)

This file exists so a new agent can pick up the Gemini-based race portrait regeneration work without re-discovering context.

## Goal ("Done" Definition)

For every (race, gender) listed in `docs/portraits/race_portrait_regen_backlog.json`:

- Generate a fresh image and save it to the existing public asset path (ex: `public/assets/images/races/<...>.png`).
- Image must be:
  - Square (1:1).
  - Full-body, head-to-toe visible (with some ground beneath the feet).
  - Background fills edge-to-edge (no blank/white margins / letterboxing).
  - Slice-of-life / mundane daily life (not combat, not hero pose).
  - Civilian attire (no armor, no weapons, no military regalia).
  - No arrows (Gemini often draws weird arrow artifacts).
- Dataset hygiene:
  - Each race/gender should have a unique slice-of-life activity (avoid reusing the same “chore” for everyone).
  - Start a new Gemini chat between each generation to avoid “same environment pasted” and “re-download previous image” issues.

## Where Progress Is Tracked

Primary:

- `public/assets/images/races/race-image-status.json`
  - One entry per image path.
  - Contains `race`, `gender`, `category`, `activity`, `prompt`, `sha256`, `downloadedAt`.

Derived reports (regenerated frequently during runs):

- `scripts/audits/slice-of-life-settings.md`
- `scripts/audits/slice-of-life-settings.json`
  - Includes all Character Creator race/gender pairs (212 rows), latest activity per pair, and duplicate activity clusters.

Quick tail helper:

- `python scripts/audits/race-status-tail.py --n 40`

## Current Status Snapshot

Timestamp when this snapshot was written: 2026-02-11T01:06 (local)

Backlog status:

- `scripts/audits/list-backlog-progress.py` reports:
  - `missing_pairs_with_raceId: 0`
  - `unresolved_by_name_pairs: 0`

Latest completed backlog item (per status tail):

- `half_orc (female)` saved at `2026-02-11T01:05:57.380Z` to:
  - `public/assets/images/races/Half_Orc_Female.png`

Post-run audits:

- `python scripts/audits/list-non-square-race-images.py`: `non_square: 0`
- `npx tsx scripts/audits/audit-race-image-bytes.ts`:
  - `missingCount: 0`
  - `referencedDuplicateShaCount: 0`
  - `folderDuplicateShaCount: 0`
- `npx tsx scripts/audits/verify-cc-glossary-race-sync.ts`:
  - `missingGlossaryCount: 0`
  - `imagePathMismatchCount: 0`
  - `missingImageFileCount: 0`
  - `missingGroupMembershipCount: 0`
  - `wrongGroupMembershipCount: 0`
- `npx tsx scripts/audits/list-slice-of-life-settings.ts`:
  - `totalCcRacePairs: 212`
  - `rowsWithActivity: 151`
  - `regeneratedPairs: 78`
  - `duplicatedActivitiesAcrossRegeneratedPairs: 23`
  - `duplicatedRowsAcrossRegeneratedPairs: 53`

Known “needs follow-up” from manual review:

- Aarakocra images tend to drift into dramatic wingspan / high-altitude scenes.
  - Overrides were added, but manual acceptance is still required.
- Slice-of-life uniqueness is not fully clean yet:
  - 23 duplicate activity clusters remain across regenerated pairs (see `scripts/audits/slice-of-life-settings.md`).

## Remaining Work (What’s Still Left)

Backlog generation is complete (all backlog pairs have status entries).

Remaining work is manual QA:

- Spot check images for the acceptance criteria (full-body, no blank margins, slice-of-life, civilian attire, no arrows).
- If any race still fails visually, add a prompt override in `scripts/regenerate-race-images-from-backlog.ts` and re-run that race/gender.

## How The Automation Works (Specific)

### 1) Chrome + Gemini access

- Start debug Chrome:
  - `npm run mcp:chrome`
- This opens Chrome with:
  - remote debugging on `127.0.0.1:9222`
  - profile dir: `.chrome-gemini-profile`
  - Gemini tab: `https://gemini.google.com/app`
- IMPORTANT: the debug Chrome launch now includes:
  - `--disable-features=SharedStorageAPI,SharedStorage`
  - This prevents a Playwright CDP crash on `shared_storage_worklet` targets.

File: `scripts/launch-debug-chrome.js`

### 2) Backlog-driven regen runner

Primary runner:

- `scripts/regenerate-race-images-from-backlog.ts`

Behavior:

- Reads `docs/portraits/race_portrait_regen_backlog.json`.
- Resolves `raceName` to a `raceId` by parsing `src/data/races/*.ts`.
- Builds a Gemini prompt with a structured `SPEC_JSON` and *positive* constraints (avoid heavy “negative prompting”).
- Enforces new chat for each generation (via Gemini automation).
- Downloads the newest generated image and saves it to the target asset path.
- Quality gates:
  - Blank margin detector: `python scripts/audits/detect-blank-margins.py <path>`
  - Square detector: `python scripts/audits/check-image-square.py <path>`
  - Duplicate bytes detector via sha256: `recordRaceImageDownload()` compares hashes inside `race-image-status.json`
- After each successful image, updates the slice-of-life report by running:
  - `npx tsx scripts/audits/list-slice-of-life-settings.ts`

### 3) Gemini download robustness

File: `scripts/image-gen-mcp.ts`

Gemini download now tries:

1. Use the last image `img.src` (raw), then a normalized variant (some `googleusercontent` URLs break if normalized).
2. Download via `activePage.context().request.get(url)` with a Gemini referer header.
3. If that fails, open the URL in a temporary tab and download via `page.goto(url)` and `resp.body()`.
4. If that fails, screenshot the last image element as a fallback.

This was added because `{"detail":"Bad Request"}` / HTTP 400 errors reappeared intermittently during download.

## Commands (Copy/Paste)

Run the whole backlog sequentially (recommended):

```bat
cd /d F:\Repos\Aralia
set IMAGE_GEN_USE_CDP=1
set IMAGE_GEN_STRICT_NEW_CHAT=1
set IMAGE_GEN_GEMINI_IMAGE_TIMEOUT_MS=360000
npx tsx scripts\regenerate-race-images-from-backlog.ts --retries 10 --cooldown-ms 7000
```

Run a single race (useful for manual review / fixes):

```bat
cd /d F:\Repos\Aralia
set IMAGE_GEN_USE_CDP=1
set IMAGE_GEN_STRICT_NEW_CHAT=1
set IMAGE_GEN_GEMINI_IMAGE_TIMEOUT_MS=360000
npx tsx scripts\regenerate-race-images-from-backlog.ts --race protector_aasimar --gender male --retries 10 --cooldown-ms 7000
```

Audit helpers:

```bat
cd /d F:\Repos\Aralia
python scripts\audits\race-status-tail.py --n 40
python scripts\audits\list-non-square-race-images.py
```

## Known Issues / Troubleshooting

### Intermittent `{"detail":"Bad Request"}`

Observed symptom:

- Terminal prints `{"detail":"Bad Request"}` and the run stops.

Most likely sources:

- Downloading from a signed `googleusercontent` URL that rejects modified/normalized query params.
- A stale browser session or multiple concurrent regen processes fighting the same CDP Chrome.

Mitigations:

- Ensure only one regen process is running.
- Restart the debug Chrome:
  - Close Chrome, then re-run `npm run mcp:chrome`
  - Confirm port is listening: `netstat -ano | findstr :9222`
- Use single-race runs to isolate which race triggers the failure.

### Avoid arrows

Gemini often renders arrows with “feathers on both ends”.

We added a global constraint:

- `Do not include arrows or arrow-like props.`

But also avoid activities like “fletching arrows” entirely.

## Files Added/Modified In This Effort (Non-image)

Modified:

- `scripts/image-gen-mcp.ts` (robust Gemini download fallbacks)
- `scripts/launch-debug-chrome.js` (disable SharedStorage to avoid CDP crash)
- `scripts/regenerate-race-images-from-backlog.ts` (prompt rules, overrides, square-check gate, no arrows)
- `docs/portraits/race_portrait_regen_backlog.json` (reason note for aarakocra drift)

Added:

- `scripts/audits/detect-blank-margins.py` (blank margin detector)
- `scripts/audits/check-image-square.py` (non-square detector)
- `scripts/audits/list-non-square-race-images.py` (list non-square images)
- `scripts/audits/race-status-tail.py` (tail helper)
- `scripts/audits/list-backlog-progress.py` (basic backlog/status reporting; does not resolve raceName->raceId)
- `scripts/audits/verify-cc-glossary-race-sync.ts` (CC vs Glossary images + group membership verifier)

## Verification Notes

- `scripts/validateRaceImages.ts` currently reports many SHA mismatches after regen runs because
  `public/assets/images/races/race-image-status.json` is append-only and retains older hashes for the same image paths.
- For current-state verification, prefer:
  - `npx tsx scripts/audits/audit-race-image-bytes.ts` (current referenced bytes)
  - `npx tsx scripts/audits/verify-cc-glossary-race-sync.ts` (CC/Glossary path + grouping sync)

## Run Log (Chronological)

(Append-only notes during long runs. New lines are appended by `scripts/regenerate-race-images-from-backlog.ts`.)
- 2026-02-10T23:50:13.539Z [start] planned=11 args=--category B --skip-written-after 2026-02-10T23:23:54.266Z --retries 10 --cooldown-ms 7000
- 2026-02-10T23:50:13.541Z [begin] B fallen_aasimar male -> assets/images/races/Aasimar_Fallen_Male.png
- 2026-02-10T23:50:40.155Z [done] B fallen_aasimar male path=assets/images/races/Aasimar_Fallen_Male.png activity="planting herb seedlings into a small soil bed using a simple hand trowel"
- 2026-02-11T00:11:27.128Z [start] planned=78 args=--dry-run --skip-written-after 2026-02-10T00:00:00.000Z

Note: the user reported intermittent terminal prints of `{"detail":"Bad Request"}`; when this happens the long batch can stop. The download logic in `scripts/image-gen-mcp.ts` was hardened, but this still reappears intermittently.
- 2026-02-11T00:21:49.949Z [start] planned=11 args=--category B --skip-written-after 2026-02-10T23:50:40.149Z --retries 10 --cooldown-ms 7000
- 2026-02-11T00:21:49.951Z [begin] B fallen_aasimar male -> assets/images/races/Aasimar_Fallen_Male.png
- 2026-02-11T00:22:18.940Z [done] B fallen_aasimar male path=assets/images/races/Aasimar_Fallen_Male.png activity="planting herb seedlings into a small soil bed using a simple hand trowel"
- 2026-02-11T00:22:27.163Z [begin] B fallen_aasimar female -> assets/images/races/Aasimar_Fallen_Female.png
- 2026-02-11T00:22:53.822Z [done] B fallen_aasimar female path=assets/images/races/Aasimar_Fallen_Female.png activity="baking bread using a wooden peel to slide a loaf into a communal oven"
- 2026-02-11T00:23:02.031Z [begin] B protector_aasimar male -> assets/images/races/Aasimar_Protector_Male.png
- 2026-02-11T00:23:28.411Z [retry] blank-margins protector_aasimar male
- 2026-02-11T00:24:00.946Z [done] B protector_aasimar male path=assets/images/races/Aasimar_Protector_Male.png activity="sharpening kitchen knives in a modest kitchen (hands using a whetstone; focus on careful craft)"
- 2026-02-11T00:24:09.227Z [begin] B protector_aasimar female -> assets/images/races/Aasimar_Protector_Female.png
- 2026-02-11T00:24:35.259Z [done] B protector_aasimar female path=assets/images/races/Aasimar_Protector_Female.png activity="mending a torn cloak with needle and thread by window light"
- 2026-02-11T00:24:43.439Z [begin] B scourge_aasimar male -> assets/images/races/Aasimar_Scourge_Male.png
- 2026-02-11T00:25:10.024Z [done] B scourge_aasimar male path=assets/images/races/Aasimar_Scourge_Male.png activity="preparing tea for guests at a monastery refectory table (kettle, cups, steam visible)"
- 2026-02-11T00:25:18.230Z [begin] B scourge_aasimar female -> assets/images/races/Aasimar_Scourge_Female.png
- 2026-02-11T00:25:44.319Z [done] B scourge_aasimar female path=assets/images/races/Aasimar_Scourge_Female.png activity="weaving a small basket from reeds at a simple work table (hands weaving clearly visible)"
- 2026-02-11T00:25:52.810Z [begin] B astral_elf male -> assets/images/races/Elf_Astral_Male.png
- 2026-02-11T00:26:18.470Z [done] B astral_elf male path=assets/images/races/Elf_Astral_Male.png activity="polishing glassware behind a tavern counter (rag and glass clearly visible)"
- 2026-02-11T00:26:26.680Z [begin] B astral_elf female -> assets/images/races/Elf_Astral_Female.png
- 2026-02-11T00:26:52.588Z [done] B astral_elf female path=assets/images/races/Elf_Astral_Female.png activity="painting simple signs for a shopfront (brush and painted lettering board visible, no text in final image)"
- 2026-02-11T00:27:00.864Z [begin] B abyssal_tiefling male -> assets/images/races/Tiefling_Abyssal_Male.png
- 2026-02-11T00:27:27.382Z [done] B abyssal_tiefling male path=assets/images/races/Tiefling_Abyssal_Male.png activity="packing a merchant crate with careful inventory (hands placing items into a crate; ledger nearby)"
- 2026-02-11T00:27:35.712Z [begin] B abyssal_tiefling female -> assets/images/races/Tiefling_Abyssal_Female.png
- 2026-02-11T00:28:01.622Z [retry] blank-margins abyssal_tiefling female
- 2026-02-11T00:28:35.568Z [retry] blank-margins abyssal_tiefling female
- 2026-02-11T00:29:08.857Z [retry] blank-margins abyssal_tiefling female
- 2026-02-11T00:29:46.120Z [done] B abyssal_tiefling female path=assets/images/races/Tiefling_Abyssal_Female.png activity="sorting mail and parchments at a courier desk (hands sorting clearly visible)"
- 2026-02-11T00:29:54.475Z [begin] B infernal_tiefling male -> assets/images/races/Tiefling_Infernal_Male.png
- 2026-02-11T00:30:21.758Z [retry] blank-margins infernal_tiefling male
- 2026-02-11T00:30:54.596Z [retry] blank-margins infernal_tiefling male
- 2026-02-11T00:31:27.483Z [retry] blank-margins infernal_tiefling male
- 2026-02-11T00:32:00.899Z [retry] blank-margins infernal_tiefling male
- 2026-02-11T00:32:34.573Z [done] B infernal_tiefling male path=assets/images/races/Tiefling_Infernal_Male.png activity="repairing a wagon wheel with basic tools"
- 2026-02-11T00:35:16.049Z [start] planned=25 args=--category C --retries 10 --cooldown-ms 7000
- 2026-02-11T00:35:16.051Z [begin] C giff male -> assets/images/races/giff_male.png
- 2026-02-11T00:35:42.546Z [done] C giff male path=assets/images/races/giff_male.png activity="copying ledgers in an office nook with ink-stained fingers"
- 2026-02-11T00:35:50.928Z [begin] C giff female -> assets/images/races/giff_female.png
- 2026-02-11T00:36:17.313Z [done] C giff female path=assets/images/races/giff_female.png activity="serving stew from a pot at a roadside inn"
- 2026-02-11T00:36:25.468Z [begin] C hadozee female -> assets/images/races/Hadozee_Female.png
- 2026-02-11T00:36:51.853Z [done] C hadozee female path=assets/images/races/Hadozee_Female.png activity="setting lanterns along a street at dusk"
- 2026-02-11T00:37:00.016Z [begin] C minotaur female -> assets/images/races/Minotaur_Female.png
- 2026-02-11T00:37:26.742Z [done] C minotaur female path=assets/images/races/Minotaur_Female.png activity="training a working animal (mule/ox) with gentle guidance"
- 2026-02-11T00:37:34.879Z [begin] C gold_dragonborn male -> assets/images/races/Dragonborn_Gold_Male.png
- 2026-02-11T00:38:01.375Z [done] C gold_dragonborn male path=assets/images/races/Dragonborn_Gold_Male.png activity="preparing tea for guests"
- 2026-02-11T00:38:09.695Z [begin] C blue_dragonborn male -> assets/images/races/Dragonborn_Blue_Male.png
- 2026-02-11T00:38:35.672Z [done] C blue_dragonborn male path=assets/images/races/Dragonborn_Blue_Male.png activity="packing a merchant crate with careful inventory"
- 2026-02-11T00:38:43.832Z [begin] C kobold female -> assets/images/races/kobold_female.png
- 2026-02-11T00:39:09.456Z [retry] blank-margins kobold female
- 2026-02-11T00:39:44.484Z [done] C kobold female path=assets/images/races/kobold_female.png activity="mixing dyes in small jars at a craft table"
- 2026-02-11T00:39:52.676Z [begin] C centaur female -> assets/images/races/Centaur_Female.png
- 2026-02-11T00:40:19.100Z [done] C centaur female path=assets/images/races/Centaur_Female.png activity="sweeping a library aisle"
- 2026-02-11T00:40:27.415Z [begin] C firbolg female -> assets/images/races/Firbolg_Female.png
- 2026-02-11T00:40:55.342Z [done] C firbolg female path=assets/images/races/Firbolg_Female.png activity="practicing calligraphy, testing brush strokes on scrap paper"
- 2026-02-11T00:41:03.588Z [begin] C bugbear male -> assets/images/races/Bugbear_Male.png
- 2026-02-11T00:41:29.934Z [done] C bugbear male path=assets/images/races/Bugbear_Male.png activity="haggling politely with a vendor, holding a coin purse"
- 2026-02-11T00:41:38.088Z [begin] C bugbear female -> assets/images/races/Bugbear_Female.png
- 2026-02-11T00:42:05.417Z [done] C bugbear female path=assets/images/races/Bugbear_Female.png activity="rolling barrels in a cellar"
- 2026-02-11T00:42:13.796Z [begin] C hobgoblin male -> assets/images/races/hobgoblin_male.png
- 2026-02-11T00:42:41.650Z [done] C hobgoblin male path=assets/images/races/hobgoblin_male.png activity="delivering parcels in a busy street"
- 2026-02-11T00:42:49.814Z [begin] C half_elf male -> assets/images/races/Half_elf_Male.png
- 2026-02-11T00:43:16.956Z [retry] blank-margins half_elf male
- 2026-02-11T00:43:50.433Z [done] C half_elf male path=assets/images/races/Half_elf_Male.png activity="washing hands at a basin after work (grounded realism)"
- 2026-02-11T00:43:58.590Z [begin] C half_elf female -> assets/images/races/Half_elf_Female.png
- 2026-02-11T00:44:24.898Z [done] C half_elf female path=assets/images/races/Half_elf_Female.png activity="baking bread in a communal oven, dusted with flour"
- 2026-02-11T00:44:33.074Z [begin] C half_elf_wood male -> assets/images/races/Half-Elf_Wood_Male.png
- 2026-02-11T00:44:59.625Z [done] C half_elf_wood male path=assets/images/races/Half-Elf_Wood_Male.png activity="tending a forge as a helper, carrying tongs and coal (no armor, no weapons)"
- 2026-02-11T00:45:07.784Z [begin] C half_elf_wood female -> assets/images/races/Half-Elf_Wood_Female.png
- 2026-02-11T00:45:34.188Z [done] C half_elf_wood female path=assets/images/races/Half-Elf_Wood_Female.png activity="packing a merchant crate with careful inventory"
- 2026-02-11T00:45:42.355Z [begin] C hearthkeeper_halfling male -> assets/images/races/Halfling_Hearthkeeper_Male.png
- 2026-02-11T00:46:10.492Z [done] C hearthkeeper_halfling male path=assets/images/races/Halfling_Hearthkeeper_Male.png activity="packing a merchant crate with careful inventory"
- 2026-02-11T00:46:18.845Z [begin] C forgeborn_human male -> assets/images/races/Human_Forgeborn_Male.png
- 2026-02-11T00:46:45.451Z [retry] blank-margins forgeborn_human male
- 2026-02-11T00:47:19.412Z [retry] blank-margins forgeborn_human male
- 2026-02-11T00:47:54.695Z [done] C forgeborn_human male path=assets/images/races/Human_Forgeborn_Male.png activity="delivering parcels in a busy street"
- 2026-02-11T00:48:02.855Z [begin] C forgeborn_human female -> assets/images/races/Human_Forgeborn_Female.png
- 2026-02-11T00:48:31.626Z [done] C forgeborn_human female path=assets/images/races/Human_Forgeborn_Female.png activity="hanging herbs to dry from rafters"
- 2026-02-11T00:48:39.801Z [begin] C kalashtar male -> assets/images/races/kalashtar_male.png
- 2026-02-11T00:49:06.404Z [done] C kalashtar male path=assets/images/races/kalashtar_male.png activity="sweeping a library aisle"
- 2026-02-11T00:49:14.552Z [begin] C kalashtar female -> assets/images/races/kalashtar_female.png
- 2026-02-11T00:49:41.823Z [done] C kalashtar female path=assets/images/races/kalashtar_female.png activity="carving wooden utensils at a simple workbench"
- 2026-02-11T00:49:50.005Z [begin] C kender male -> assets/images/races/kender_male.png
- 2026-02-11T00:50:17.828Z [done] C kender male path=assets/images/races/kender_male.png activity="baking bread in a communal oven, dusted with flour"
- 2026-02-11T00:50:26.005Z [begin] C kender female -> assets/images/races/kender_female.png
- 2026-02-11T00:50:53.433Z [done] C kender female path=assets/images/races/kender_female.png activity="carrying water buckets from a well"
- 2026-02-11T00:51:01.592Z [begin] C changeling male -> assets/images/races/Changeling_Male.png
- 2026-02-11T00:51:28.668Z [retry] blank-margins changeling male
- 2026-02-11T00:52:02.606Z [retry] blank-margins changeling male
- 2026-02-11T00:52:36.534Z [done] C changeling male path=assets/images/races/Changeling_Male.png activity="painting simple signs for a shopfront"
- 2026-02-11T00:52:44.700Z [begin] C changeling female -> assets/images/races/Changeling_Female.png
- 2026-02-11T00:53:12.035Z [done] C changeling female path=assets/images/races/Changeling_Female.png activity="mending a torn cloak with needle and thread by window light"
- 2026-02-11T00:55:58.680Z [start] planned=8 args=--category D --retries 10 --cooldown-ms 7000
- 2026-02-11T00:55:58.683Z [begin] D kobold male -> assets/images/races/kobold_male.png
- 2026-02-11T00:56:26.456Z [done] D kobold male path=assets/images/races/kobold_male.png activity="inspecting fish at a market table, choosing today's catch"
- 2026-02-11T00:56:34.647Z [begin] D pallid_elf male -> assets/images/races/Elf_Pallid_Male.png
- 2026-02-11T00:57:00.858Z [done] D pallid_elf male path=assets/images/races/Elf_Pallid_Male.png activity="mixing dyes in small jars at a craft table"
- 2026-02-11T00:57:09.013Z [begin] D firbolg male -> assets/images/races/Firbolg_Male.png
- 2026-02-11T00:57:37.074Z [done] D firbolg male path=assets/images/races/Firbolg_Male.png activity="tending a forge as a helper, carrying tongs and coal (no armor, no weapons)"
- 2026-02-11T00:57:45.227Z [begin] D forest_gnome female -> assets/images/races/Gnome_Forest_Female.png
- 2026-02-11T00:58:13.072Z [retry] blank-margins forest_gnome female
- 2026-02-11T00:58:47.905Z [retry] blank-margins forest_gnome female
- 2026-02-11T00:59:22.968Z [done] D forest_gnome female path=assets/images/races/Gnome_Forest_Female.png activity="tidying a small altar, lighting candles"
- 2026-02-11T00:59:31.124Z [begin] D rock_gnome male -> assets/images/races/Gnome_Rock_Male.png
- 2026-02-11T00:59:58.763Z [done] D rock_gnome male path=assets/images/races/Gnome_Rock_Male.png activity="measuring cloth at a tailor stall"
- 2026-02-11T01:00:07.144Z [begin] D wordweaver_gnome female -> assets/images/races/Gnome_Wordweaver_Female.png
- 2026-02-11T01:00:34.328Z [retry] blank-margins wordweaver_gnome female
- 2026-02-11T01:01:09.261Z [done] D wordweaver_gnome female path=assets/images/races/Gnome_Wordweaver_Female.png activity="sorting mail/parchments in a courier station"
- 2026-02-11T01:01:17.460Z [begin] D orc male -> assets/images/races/Orc_Male.png
- 2026-02-11T01:01:45.263Z [retry] blank-margins orc male
- 2026-02-11T01:02:19.861Z [done] D orc male path=assets/images/races/Orc_Male.png activity="practicing calligraphy, testing brush strokes on scrap paper"
- 2026-02-11T01:02:28.049Z [begin] D mender_halfling male -> assets/images/races/Halfling_Mender_Male.png
- 2026-02-11T01:02:54.090Z [done] D mender_halfling male path=assets/images/races/Halfling_Mender_Male.png activity="setting out offerings at a shrine (non-magical, calm)"
- 2026-02-11T01:04:56.467Z [start] planned=2 args=--category E --retries 10 --cooldown-ms 7000
- 2026-02-11T01:04:56.469Z [begin] E half_orc male -> assets/images/races/Half_Orc_Male.png
- 2026-02-11T01:05:23.166Z [done] E half_orc male path=assets/images/races/Half_Orc_Male.png activity="sorting mail/parchments in a courier station"
- 2026-02-11T01:05:31.316Z [begin] E half_orc female -> assets/images/races/Half_Orc_Female.png
- 2026-02-11T01:05:57.386Z [done] E half_orc female path=assets/images/races/Half_Orc_Female.png activity="polishing glassware behind a tavern counter"
- 2026-02-11T10:50:51.572Z [start] planned=1 args=--dry-run --limit 1
- 2026-02-11T10:58:59.377Z [start] planned=1 args=--dry-run --limit 1
- 2026-02-11T11:06:42.787Z [start] planned=1 args=--dry-run --limit 1
