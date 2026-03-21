# Race Portrait Regeneration Backlog

Last reviewed: 2026-03-12

This file is a human-readable seed list for the portrait-regeneration lane.

Use these files for current state before deciding what is still open:
- docs/portraits/race_portrait_regen_backlog.json for the machine-readable backlog seed
- public/assets/images/races/race-image-status.json for per-image generation history
- scripts/audits/slice-of-life-settings.json for the current QA and uniqueness ledger

Important status note:
- the checkboxes in this markdown file are not the canonical completion signal anymore
- the dual-state QA ledger now carries the live visual and uniqueness status
- keep this file as a readable reason list, not as the final source of truth

Legend:
- Category A: character is cut off (not fully visible head-to-toe)
- Category B: not slice-of-life setting
- Category C: output quality issues
- Category D: visible white edge or border artifact
- Category E: no images loaded or missing

## Category A (Cropped or not fully visible)

- [ ] Verdan (Male, Female)
- [ ] Aarakocra (Male, Female)
- [ ] Kenku (Female)
- [ ] Loxodon (Male)
- [ ] Warforged (Female)
- [ ] Copper Dragonborn (Male, Female)
- [ ] Green Dragonborn (Female)
- [ ] Silver Dragonborn (Male)
- [ ] Duergar / Gray Dwarf (Male, Female)
- [ ] Hill Dwarf (Female)
- [ ] Runeward Dwarf (Male)
- [ ] High Elf (Male, Female)
- [ ] Pallid Elf (Female)
- [ ] Sea Elf (Female)
- [ ] Shadowveil Elf (Female)
- [ ] Fire Genasi (Male, Female)
- [ ] Water Genasi (Male)
- [ ] Githyanki (Male)
- [ ] Githzerai (Male)
- [ ] Goblin (Female)
- [ ] High Half-Elf (Female)
- [ ] Seersight Half-Elf (Female)
- [ ] Stormborn Half-Elf (Female)
- [ ] Beastborn Human (Female)
- [ ] Triton (Female)
- [ ] Vedalken (Female)

## Category B (Not slice-of-life, needs a new activity)

Note: keep a list of already-used slice-of-life activities and avoid reusing the same one across many races.

- [ ] Fallen Aasimar (Male, Female)
- [ ] Protector Aasimar (Male, Female)
- [ ] Scourge Aasimar (Male, Female)
- [ ] Astral Elf (Male, Female)
- [ ] Abyssal Tiefling (Male, Female)
- [ ] Infernal Tiefling (Male)

## Category C (Output quality concerns)

- [ ] Giff (Male, Female): Male not hippo enough; Female too hippo-like.
- [ ] Hadozee (Female): not simian enough.
- [ ] Minotaur (Female): head size too large.
- [ ] Gold Dragonborn (Male): duplicate or cookie-cutter feel.
- [ ] Blue Dragonborn (Male): duplicate or cookie-cutter feel.
- [ ] Kobold (Female): gender not readable.
- [ ] Centaur (Female): humanoid torso not aligned to horse body properly.
- [ ] Firbolg (Female): not matching male racial visuals.
- [ ] Githyanki (Male): quality issues.
- [ ] Bugbear (Male, Female): male and female mismatch in racial visuals.
- [ ] Hobgoblin (Male): nose shape issue.
- [ ] Half-Elf (Male, Female): too samey.
- [ ] Wood Half-Elf (Male, Female): green skin questionable; needs research-backed prompt guidance.
- [ ] Hearthkeeper Halfling (Male): clones in background.
- [ ] Forgeborn Human (Male, Female): blue skin questionable; needs research-backed prompt guidance.
- [ ] Kalashtar (Male, Female): too samey.
- [ ] Kender (Male, Female): too samey.
- [ ] Changeling (Male, Female): try a mid-transformation slice-of-life prompt.

## Category D (White edge or border artifact)

- [ ] Kobold (Male)
- [ ] Pallid Elf (Male)
- [ ] Firbolg (Male)
- [ ] Forest Gnome (Female)
- [ ] Rock Gnome (Male)
- [ ] Wordweaver Gnome (Female)
- [ ] Orc (Male)
- [ ] Mender Halfling (Male)

## Category E (Missing or not loading)

- [ ] Half-Orc (Male, Female)
