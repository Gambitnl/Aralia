# Spell Branch Navigator Node Cleanup — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove infrastructure-only nodes (Spell List Source, Spell List Loader and their 6 children) from the Spell Branch Navigator sub-branch in the roadmap, delete the stale media capture, and add a top-level capability GIF for the Spell Branch Navigator parent node.

**Architecture:** All changes are in `generate.ts` (roadmap data source), `.media/` (capture files and capture script), and one stale PNG deletion. No React or TypeScript component changes needed.

**Tech Stack:** TypeScript (`generate.ts`), Node.js/Playwright (`capture-gifs-screenshots.mjs`), ffmpeg (GIF encoding)

---

### Task 1: Remove infrastructure nodes from `generate.ts` — paths list

**Files:**
- Modify: `devtools/roadmap/scripts/roadmap-engine/generate.ts:93`

**Step 1: Remove the stale `Spell Profile Data Feed` path entry**

In the `ALL_PATHS` array (around line 93), remove this line:
```
'Roadmap Tool > Spell Branch Navigator > Spell Profile Data Feed',
```

The list should go from:
```ts
'Roadmap Tool > Spell Branch Navigator',
'Roadmap Tool > Spell Branch Navigator > Spell Profile Data Feed',
'Roadmap Tool > Spell Branch Navigator > Axis Engine',
```
To:
```ts
'Roadmap Tool > Spell Branch Navigator',
'Roadmap Tool > Spell Branch Navigator > Axis Engine',
```

**Step 2: Verify visually — no Spell List Source/Loader paths exist in this list**

Search the file for `Spell List Source` and `Spell List Loader` to confirm they were never added to the paths list (they were only in descriptions and milestones). If found, remove them here too.

---

### Task 2: Remove infrastructure node descriptions from `generate.ts`

**Files:**
- Modify: `devtools/roadmap/scripts/roadmap-engine/generate.ts:876–922`

**Step 1: Delete these 8 description entries entirely**

```ts
'Roadmap Tool > Spell Branch Navigator > Spell List Source': { ... },
'Roadmap Tool > Spell Branch Navigator > Spell List Source > Spell Data Storage': { ... },
'Roadmap Tool > Spell Branch Navigator > Spell List Source > Spell Format Rules': { ... },
'Roadmap Tool > Spell Branch Navigator > Spell List Source > Spell Data Refresh': { ... },
'Roadmap Tool > Spell Branch Navigator > Spell List Loader': { ... },
'Roadmap Tool > Spell Branch Navigator > Spell List Loader > Fetch On Demand': { ... },
'Roadmap Tool > Spell Branch Navigator > Spell List Loader > Loading Indicator': { ... },
'Roadmap Tool > Spell Branch Navigator > Spell List Loader > Failed Load Recovery': { ... },
```

Also check for and remove any entry for:
```ts
'Roadmap Tool > Spell Branch Navigator > Spell Profile Data Feed': { ... },
```

---

### Task 3: Remove infrastructure node milestones from `generate.ts`

**Files:**
- Modify: `devtools/roadmap/scripts/roadmap-engine/generate.ts:1620–1627`

**Step 1: Delete these 8 milestone entries**

```ts
{ name: 'Roadmap Tool > Spell Branch Navigator > Spell List Source', state: 'done', ... },
{ name: 'Roadmap Tool > Spell Branch Navigator > Spell List Source > Spell Data Storage', state: 'done', ... },
{ name: 'Roadmap Tool > Spell Branch Navigator > Spell List Source > Spell Format Rules', state: 'done', ... },
{ name: 'Roadmap Tool > Spell Branch Navigator > Spell List Source > Spell Data Refresh', state: 'done', ... },
{ name: 'Roadmap Tool > Spell Branch Navigator > Spell List Loader', state: 'done', ... },
{ name: 'Roadmap Tool > Spell Branch Navigator > Spell List Loader > Fetch On Demand', state: 'done', ... },
{ name: 'Roadmap Tool > Spell Branch Navigator > Spell List Loader > Loading Indicator', state: 'done', ... },
{ name: 'Roadmap Tool > Spell Branch Navigator > Spell List Loader > Failed Load Recovery', state: 'done', ... },
```

Keep these (they're correct):
```ts
{ name: 'Roadmap Tool > Spell Branch Navigator', state: 'active', ... },
{ name: 'Roadmap Tool > Spell Branch Navigator > Axis Engine', state: 'done', ... },
{ name: 'Roadmap Tool > Spell Branch Navigator > VSM Drill-Down Navigator', state: 'done', ... },
{ name: 'Roadmap Tool > Spell Branch Navigator > Requirements Component Mapping', state: 'done', ... },
```

**Step 2: Commit**

```bash
git add devtools/roadmap/scripts/roadmap-engine/generate.ts
git commit -m "refactor(roadmap): remove infrastructure-only nodes from Spell Branch Navigator"
```

---

### Task 4: Delete the stale media capture

**Files:**
- Delete: `devtools/roadmap/.media/sub_pillar_dev_tools_roadmap_tool_spell_branch_navigator_spell_profile_data_feed.png`

**Step 1: Delete the file**

```bash
rm "devtools/roadmap/.media/sub_pillar_dev_tools_roadmap_tool_spell_branch_navigator_spell_profile_data_feed.png"
```

**Step 2: Commit**

```bash
git add -u devtools/roadmap/.media/
git commit -m "chore(media): delete stale spell_profile_data_feed capture"
```

---

### Task 5: Add top-level Spell Branch Navigator GIF capture

**Files:**
- Modify: `devtools/roadmap/.media/capture-gifs-screenshots.mjs`

**Context:** The Spell Branch Navigator's raw node ID is `sub_pillar_dev_tools_roadmap_tool_spell_branch_navigator` (derived from: Dev Tools pillar ID `pillar_dev_tools`, full path `Roadmap Tool > Spell Branch Navigator` slugified). The output file must match this ID exactly.

The GIF should show: the Spell Branch tab loading with all axes visible — a clean capability overview. User sees the navigator in its initial state, then a filter applied (e.g., click Wizard under Class).

**Step 1: Add this function to `capture-gifs-screenshots.mjs` before the `main()` function**

```js
async function captureSpellBranchNavigatorOverview() {
  cleanFrames();
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 900, height: 700 });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Switch to Spell Branch tab
  await page.locator('button').filter({ hasText: /^spell branch$/i }).first().click();
  await page.waitForTimeout(1500);

  // Frame set A: full navigator, all axes visible (3 frames)
  let idx = 0;
  for (let i = 0; i < 3; i++) {
    const buf = await page.screenshot();
    writeFileSync(join(FRAMES_DIR, `sbn_${String(idx++).padStart(4, '0')}.png`), buf);
    await page.waitForTimeout(300);
  }

  // Click Wizard under Class to show filtering in action
  const wizardBtn = page.locator('button').filter({ hasText: /^Wizard$/i }).first();
  if (await wizardBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await wizardBtn.click();
    await page.waitForTimeout(1000);
  }

  // Frame set B: navigator filtered by Wizard (4 frames)
  for (let i = 0; i < 4; i++) {
    const buf = await page.screenshot();
    writeFileSync(join(FRAMES_DIR, `sbn_${String(idx++).padStart(4, '0')}.png`), buf);
    await page.waitForTimeout(300);
  }

  await browser.close();

  const outputPath = join(MEDIA_DIR, 'sub_pillar_dev_tools_roadmap_tool_spell_branch_navigator.gif');
  framesToGif(FRAMES_DIR, 'sbn', outputPath, null);
  console.log('✓ Spell Branch Navigator overview GIF saved');
}
```

**Step 2: Wire it into `main()`**

```js
async function main() {
  console.log('Capturing GIF: Spell Branch Navigator Overview...');
  await captureSpellBranchNavigatorOverview();

  console.log('Capturing GIF: Live Axis Filtering Engine...');
  await captureLiveAxisFiltering();

  console.log('Capturing GIF: Spell Branch Tab Handoff...');
  await captureSpellBranchHandoff();

  console.log('\nDone.');
}
```

---

### Task 6: Run the capture script

**Step 1: Ensure the dev server is running on port 3010**

The Vite dev server must be running (`npm run dev` from repo root) before the script can navigate the roadmap.

**Step 2: Run the capture script**

```bash
node devtools/roadmap/.media/capture-gifs-screenshots.mjs
```

Expected output:
```
Capturing GIF: Spell Branch Navigator Overview...
✓ Spell Branch Navigator overview GIF saved
Capturing GIF: Live Axis Filtering Engine...
✓ Live Axis Filtering Engine GIF saved
Capturing GIF: Spell Branch Tab Handoff...
✓ Spell Branch Tab Handoff GIF saved

Done.
```

**Step 3: Verify the output file exists**

```bash
ls devtools/roadmap/.media/sub_pillar_dev_tools_roadmap_tool_spell_branch_navigator.gif
```

**Step 4: Commit**

```bash
git add devtools/roadmap/.media/
git commit -m "feat(media): add top-level Spell Branch Navigator capability GIF"
```

---

### Task 7: Verify in browser

**Step 1: Hard refresh the roadmap page** (Ctrl+Shift+R) to ensure Vite serves the updated `generate.ts` output.

**Step 2: Confirm removed nodes are gone**

In the canvas, expand Dev Tools → Roadmap Tool → Spell Branch Navigator. You should see only:
- Axis Engine
- VSM Drill-Down Navigator
- Requirements Component Mapping

You should NOT see: Spell List Source, Spell List Loader, or any of their children.

**Step 3: Confirm VIEW PREVIEW on parent node**

Click "Spell Branch Navigator" in the canvas. The info panel should show a **VIEW PREVIEW** button. Click it — the lightbox should open with the new overview GIF.

**Step 4: Confirm existing previews still work**

Click Axis Engine, VSM Drill-Down Navigator, and Requirements Component Mapping — each should still show VIEW PREVIEW and open their existing captures.
