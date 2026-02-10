# Race Glossary Sync - Open Questions + Decisions

Last updated: 2026-02-09

Scope: Align Glossary race grouping and images with Character Creator; decide how to handle base-race chooser entries and trait inheritance.

## Question Index (One-Liners)

- Q1: Ruleset strategy (keep 2014 and 2024 where they differ).
- Q1a: Flavor labels for the two variants (chosen: Oathbound vs Dawnforged).
- Q1b: Where variants appear (chosen: both CC and Glossary when significant).
- Q1c: What counts as "significant difference" (chosen: case-by-case; wording-only is not significant).
- Q1d: Which races are affected (repo evidence).
- Q2: Should Glossary grouping match Character Creator exactly (chosen: yes, exact match).
- Q3: When to hide base races vs show variants-only (chosen: forced-choice bases are variants-only).
- Q4: What Glossary should do with forced-choice bases (chosen: Aasimar method, variants-only in group).
- Q5: Trait inheritance policy when removing base races (chosen: case-by-case).
- Q6: How chooser traits appear on variants (chosen: variants replace chooser text).
- Q7: Half-elf trait gaps handling (chosen: research first, then decide).
- Q8: Standardize trait wording keys (chosen: yes when mechanically identical; use clearest wording).
- Q9: Glossary race images source of truth (chosen: mirror Character Creator).
- Q10: Missing male/female image fallback (chosen: if it happens, placeholder; currently none known).
- Q11: Keep legacy `imageUrl` field (chosen: no, use male/female only).
- Q12: Normalize race IDs across CC and Glossary (chosen: normalize IDs).
- Q13: Web research scope for trait differences (chosen: research each family).
- Q14: CC variant naming style (chosen: "Subtype Race" naming).
- Q15: Dragonborn base vs variants-only (chosen: variants-only, forced-choice).
- Q16: CC Compare Variants trait coverage (chosen: all traits).
- Q17: Trait icons shared mapping across Glossary + CC (chosen: yes).
- Q18: CC Compare Variants tooltip behavior (chosen: hover + pin with close x).

## Status Key

- Answered: Decision is made.
- Pending: Needs your answer.
- Blocked: Needs research or depends on other answers.

---

## Q1. Ruleset Strategy (2014 vs 2024)

Status: Answered

Decision:

- Keep both 2014 and 2024 where they differ.
- Differentiate them by "flavor name" (clear naming so players can tell which is which).
- In files, comment the source (2014/2024) when the variants differ.
- If identical, no need to duplicate.

### Q1a. Flavor Name Convention (No years / no "legacy" / no "revised")

Status: Answered

Question:

- What naming scheme should we use to distinguish the two variants in the UI when they differ?

Constraints (from your answer):

- Do not use years (no "(2014)" or "(2024)").
- Do not use "Legacy" or "Revised".
- Prefer a high-fantasy naming direction (your latest preference).

Decision:

- Use `(Oathbound)` for the older/classic variant and `(Dawnforged)` for the newer/updated variant.

### Q1b. Where Variants Appear (CC vs Glossary)

Status: Answered

Decision:

- If the two variants differ in a significant way, they should appear in both Character Creator and Glossary.

Notes:

- Earlier answer list included an option that looked confusing ("both" vs "CC only"). This is now resolved by the decision above.

### Q1c. What Counts as "Significant"?

Status: Answered (case-by-case)

Question:

- What differences justify showing both variants as separate selectable choices?

Examples to calibrate:

- Speed differs (25 vs 30).
- Darkvision differs (60 vs 120).
- Trait list differs (different named features).
- Only wording differs (same mechanics).

Decision:

- Evaluate significance case-by-case.
  - Wording-only differences are not significant.
  - If numeric values differ (Speed, Darkvision range, etc), treat it as a candidate for splitting, but decide case-by-case.

### Q1d. Which Races Are Actually Affected? (Repo Evidence)

Status: Answered (current state), but may expand later

What I found in the repo (based on header comments / notes in `src/data/races/*.ts`):

- Explicitly tagged as PHB 2014:
  - `forest_gnome`
  - `rock_gnome`
  - `half_elf`
  - `hill_dwarf`
  - `mountain_dwarf`
  - `lightfoot_halfling`
  - `stout_halfling`
- Explicitly tagged as PHB 2024:
  - `elf`
  - `drow`
  - `high_elf`
  - `wood_elf`
  - `air_genasi`
  - `earth_genasi`
  - `fire_genasi`
  - `water_genasi`
- Tagged as "2024 PHB style" (not always an explicit "based on PHB 2024"):
  - `halfling`
  - `tiefling`
  - `goliath`
  - `orc`
  - `dragonborn` (explicit note: kept 2014 ASIs for now)

Immediate "both-era" family conflict that already exists in the repo today:

- Halfling family:
  - We have `halfling` (2024-style: no subraces) alongside 2014 subrace entries (`lightfoot_halfling`, `stout_halfling`).
  - This makes Halfling the first place where a fantasy-flavor naming scheme is needed right away.

---

## Q2. Glossary Grouping Alignment

Status: Answered

Question:

- Should the Glossary race grouping match Character Creator exactly (same groups, titles, order, membership), or only partially?

Clarification: what "membership" means here

- "Membership" just means: which race entries are inside each group.
- Example: if "Elves" contains 8 elf variants in Character Creator, "membership match" means the Glossary "Elves" group contains the same 8 entries, even if the group label or ordering differs.

Options:

- A: Exact match to Character Creator grouping (from `src/data/races/raceGroups.ts` and `baseRace || id` logic).
- B: Match membership but keep Glossary labels/names where possible.
- C: Keep Glossary grouping as-is.

Decision:

- Option A: Exact match to Character Creator grouping (no separate truths).

---

## Q3. "Base Race" Chooser Entries: Keep Selectable or Variants-Only (Per Family)

Status: Answered (rule), pending (per-family confirmation)

Question:

- For each base-race family that currently acts like a chooser, should the base race itself remain a selectable race, or should only the variants be selectable?

Families:

- eladrin (autumn/spring/summer/winter)
- elf (astral/drow/high/pallid/sea/shadar-kai/shadowveil/wood)
- goliath (cloud/fire/frost/hill/stone/storm giant)
- tiefling (abyssal/chthonic/infernal)
- half_elf (aquatic/drow/high/wood/seersight/stormborn)
- halfling (hearthkeeper/lightfoot/lotusden/mender/stout)
- human (beastborn/forgeborn/guardian/wayfarer)

Answer format suggestion:

- `eladrin = variants-only`, `elf = keep base selectable`, etc.

Decision (rule):

- If the base race is explicitly designed for the player to make a choice (lineage/legacy/ancestry/season), then: variants-only.
- If the base race can exist on its own without forcing such a choice, then: keep base selectable, but discuss any edge cases first.

Follow-up needed (per family):

- Confirm which of the listed families you consider "explicitly designed for a forced choice" vs "can exist on its own."

Update (your confirmation):

- Forced-choice (variants-only): `elf`, `tiefling`, `goliath`, `eladrin` (and previously `aasimar` already handled).
- Can exist as a standalone choice: `human`, `half_elf`, `halfling` (you asked for a web-check for these; see Q13 research notes in the task thread).

---

## Q4. If Base Race Is Not Selectable: What Happens in the Glossary?

Status: Answered

Question:

- If we make a base race non-selectable, what should the Glossary do with the base entry?

Options:

- A: Remove the base Glossary entry entirely (only variants exist).
- B: Keep it as an "overview" page (not selectable, but explains and links to variants).
- C: Convert into a pure group header (no entry page).

Decision:

- Mirror the method currently used for Aasimar: group header exists, but the base-race entry is not present as a selectable/leaf entry (variants-only in the group).

---

## Q5. Trait Inheritance Safety Rule

Status: Answered

Question:

- When removing/hiding a base race, what must be true about traits on each variant?

Options:

- A: Only always-on baseline traits must be present (size/speed/lifespan, etc).
- B: Everything except explicit chooser traits must be present.
- C: Decide case-by-case per family.

Decision:

- Option C: Decide case-by-case per family.

---

## Q6. Chooser-Trait Presentation on Variants

Status: Answered

Question:

- For chooser traits (Lineage/Legacy/Ancestry), should variants:

Options:

- A: Replace the chooser completely (variant contains only the concrete outcome).
- B: Include a short "derived from" note plus the concrete outcome.
- C: Keep both chooser and concrete outcome.

Decision:

- Option A: Variants replace chooser text entirely (only the concrete outcome appears on the variant).

---

## Q7. Known Potential Trait Gaps (Half-Elf)

Status: Answered (approach)

Finding (from repo audits):

- `seersight_half_elf` and `stormborn_half_elf` appear to be missing "Skill Versatility" compared to base `half_elf`.

Question:

- How should we resolve this?

Options:

- A: Add "Skill Versatility" to those variants unless research proves otherwise.
- B: Remove/alter it on base `half_elf` and keep variants as-is.
- C: Research first, then decide.

Decision:

- Option C: Research first, then decide.

---

## Q8. Standardize Trait Key Names (Luck vs Lucky, Fey Step variants, etc)

Status: Answered

Question:

- Do you want standard naming of trait keys across variants?

Options:

- A: Yes, standardize to one canonical label everywhere.
- B: No, keep text as-is; only treat them as equivalent in tooling.
- C: Only standardize where it impacts UI/search/filtering.

Decision:

- Standardize when it is mechanically the same but worded differently.
- Use the clearest wording when choosing between phrasings.

---

## Q9. Glossary Images Source of Truth

Status: Answered

Question:

- Should Glossary race entries always use the same male/female images as Character Creator?

Options:

- A: Yes, Glossary mirrors Character Creator images exactly.
- B: Only fill missing/wrong ones; preserve any custom Glossary images.
- C: Keep Glossary images independent.

Decision:

- Option A: Glossary mirrors Character Creator images exactly.

---

## Q10. Glossary Image Fallback Behavior

Status: Answered (conditional)

Question:

- If one of male/female is missing, what should happen?

Options:

- A: Fall back to the other gender image.
- B: Show placeholder/class icon (no fallback).
- C: Add explicit "No portrait available" UI state.

Decision:

- If such cases exist, choose Option B (placeholder/class icon; no fallback).

Follow-up needed:

- Confirm whether any races actually have only one of male/female in Character Creator data (current image audit suggests none are missing, but we should re-check the data model if needed).

Update:

- Current state: no known cases of missing male/female race images in Character Creator. Fallback behavior remains "B if it happens."

---

## Q11. Glossary JSON Fields: Keep Legacy `imageUrl`?

Status: Answered

Question:

- Some Glossary entries may have a single `imageUrl` field. Should we keep it?

Options:

- A: Keep `imageUrl` but prefer male/female when present.
- B: Stop using `imageUrl`; use only `maleImageUrl`/`femaleImageUrl`.
- C: Keep all three but ensure consistency.

Decision (tentative):

- Option B: Stop using `imageUrl`; use only `maleImageUrl`/`femaleImageUrl`.

Follow-up requested:

- Provide examples of existing Glossary entries that currently use `imageUrl` so the impact is concrete.

Update:

- Examples exist (e.g., `deep_gnome.json` has `imageUrl` plus `maleImageUrl`/`femaleImageUrl`).
- Renderer behavior (`src/components/Glossary/GlossaryEntryTemplate.tsx`): if either `maleImageUrl` or `femaleImageUrl` is present, the legacy `imageUrl` is ignored.
- Proceeding with Option B still reduces confusion and prevents stale/placeholder legacy images from lingering.

---

## Q12. ID Mismatches (CC vs Glossary)

Status: Answered

Examples:

- `half_elf` vs `half-elf`
- `yuan_ti` vs `yuan-ti`
- `*_giant_goliath` vs `*_giant`

Question:

- Should we normalize IDs across the codebase or keep mapping glue?

Options:

- A: Normalize IDs (bigger change, cleaner long-term).
- B: Keep IDs and maintain a mapping layer.
- C: Normalize only a short list you specify.

Decision:

- Option A: Normalize IDs across the codebase.

---

## Q13. Web Research Scope (Trait Differences)

Status: Answered

Question:

- When traits differ between base and variant, should I consult external references before changing anything?

Options:

- A: Yes, research each base+variant family before finalizing trait edits.
- B: Research only when a conflict/gap is detected.
- C: No research; repo is authoritative.

Decision:

- Option A: Research each base+variant family before finalizing trait edits.

---

## Q14. Variant Naming Style in Character Creator (Half-Elf etc)

Status: Answered

Question:

- In Character Creator, should variants be named "Race (Subtype)" or "Subtype Race"?

Decision:

- Use "Subtype Race" (e.g., "Wood Half-Elf" instead of "Half-Elf (Wood)").

---

## Q15. Dragonborn: Forced-Choice Base vs Variants-Only (Draconic Ancestry)

Status: Answered (with research)

Question:

- Dragonborn in modern rules has a Draconic Ancestry choice. Should the base "Dragonborn" be selectable, or should players only pick specific ancestry variants?

Decision:

- Treat Dragonborn like other forced-choice bases (Elf/Tiefling/Goliath/Eladrin): variants-only (Aasimar method).

Research notes:

- 2024 Dragonborn includes Draconic Ancestry choice and has Darkvision (60 ft).
- 2014 Dragonborn does not have Darkvision (contrast point for 2014/2024 divergence).

---

## Q16. Compare Variants: Show All Traits

Status: Answered

Question:

- In Character Creator "Compare Variants", should the table compare only a short curated set of traits, or all traits?

Decision:

- Compare all traits (not just the first 3).

---

## Q17. Trait Icons: Shared Source of Truth (Glossary + Character Creator)

Status: Answered

Question:

- Should trait icons be driven by one shared mapping so changing an icon for trait X updates both Glossary and Character Creator?

Decision:

- Yes, one shared mapping for both.

---

## Q18. Compare Variants: Trait Tooltip Behavior

Status: Answered

Question:

- In "Compare Variants", should hovering a trait show its description, and clicking pin it with a close "x"?

Decision:

- Yes: hover shows tooltip, click pins tooltip, pinned tooltip has an "x" close button.

---

## Q19. Portrait Quality Control Pass (Backlog + Tooling)

Status: In progress

Question:

- Maintain a formal list of which race portraits must be regenerated (and why), plus tooling to:
  - list slice-of-life activities already used
  - enforce "new activity" selection for slice-of-life regen
  - batch regenerate a curated set (not only missing/duplicate)

Current state:

- Backlog captured in:
  - `docs/portraits/race_portrait_regen_backlog.md`
  - `docs/portraits/race_portrait_regen_backlog.json`
- Slice-of-life report tooling:
  - `scripts/audits/list-slice-of-life-settings.ts` outputs `scripts/audits/slice-of-life-settings.md`
- Batch regeneration tooling:
  - `scripts/regenerate-race-images-from-backlog.ts`

Unanswered / still to decide:

- Whether to support "upload existing image and outpaint/zoom out" workflow (vs always regenerate fresh).
- Whether to post-process Category D (white border) via deterministic trimming, or always regenerate.

---

## Q20. Appearance Research Flags (Prompt Guidance)

Status: Pending research

Questions:

- Wood Half-Elf: should skin tone ever be green, or only subtle woodland tint?
- Forgeborn Human (Mark of Making): should skin tone be normal human, with the dragonmark glow providing the "unusual" visual?
