# @SPELL-AUDIT-CANTRIPS

Audit of cantrip coverage vs PHB 2024 list, and format status (New vs Old).

**Method**:
- PHB 2024 cantrip list (assumed core set): Acid Splash, Blade Ward, Booming Blade, Chill Touch, Dancing Lights, Druidcraft, Eldritch Blast, Fire Bolt, Friends, Guidance, Light, Mage Hand, Magic Stone, Mending, Message, Minor Illusion, Poison Spray, Prestidigitation, Produce Flame, Ray of Frost, Resistance, Sacred Flame, Shillelagh, Shocking Grasp, Spare the Dying, Thaumaturgy, Thorn Whip, Thunderclap, Toll the Dead, True Strike, Vicious Mockery, Word of Radiance.
- Local cantrip candidates identified in `public/data/spells/` (filenames): acid-splash, blade-ward, booming-blade, chill-touch, create-bonfire, dancing-lights, druidcraft, eldritch-blast, elementalism, fire-bolt, friends, frostbite, guidance (not found), light (not found), mage-hand, magic-stone, mending, message, mind-sliver (not found), minor-illusion, mold-earth (not found), poison-spray, prestidigitation, primal-savagery (not found), produce-flame, ray-of-frost, resistance, sacred-flame, sapping-sting (not found), shape-water (not found), shillelagh, shocking-grasp, spare-the-dying, sword-burst (not found), thaumaturgy, thorn-whip, thunderclap, toll-the-dead, true-strike, vicious-mockery, word-of-radiance.

**Format determination**: New-format cantrips per prior migration note = {acid-splash, blade-ward, booming-blade, chill-touch, create-bonfire}. All others considered Old until validated.

---

## Table 1: Completed (New Format)
| Spell | Status | Notes |
|-------|--------|-------|
| acid-splash | New | Migrated cantrip batch 1 |
| blade-ward | New | Migrated cantrip batch 1 |
| booming-blade | New | Migrated cantrip batch 1 |
| chill-touch | New | Migrated cantrip batch 1 |
| create-bonfire | New | Migrated cantrip batch 1 |

---

## Table 2: Needs Migration (Old Format, Present Locally)
| Spell | Notes |
|-------|-------|
| dancing-lights | Old |
| druidcraft | Old |
| eldritch-blast | Old |
| elementalism | Old (homebrew) |
| fire-bolt | Old |
| friends | Old |
| frostbite | Old |
| mage-hand | Old |
| magic-stone | Old |
| mending | Old |
| message | Old |
| minor-illusion | Old |
| poison-spray | Old |
| prestidigitation | Old |
| produce-flame | Old |
| ray-of-frost | Old |
| resistance | Old |
| sacred-flame | Old |
| shillelagh | Old |
| shocking-grasp | Old |
| spare-the-dying | Old |
| thaumaturgy | Old |
| thorn-whip | Old |
| thunderclap | Old |
| toll-the-dead | Old |
| true-strike | Old |
| vicious-mockery | Old |
| word-of-radiance | Old |

---

## Table 3: Missing (In PHB List, Not Found Locally)
| Spell | Priority | Notes |
|-------|----------|-------|
| Guidance | Medium | Not in `public/data/spells/` |
| Light | Medium | Not in `public/data/spells/` |
| Mind Sliver | Medium | Not in `public/data/spells/` |
| Mold Earth | Medium | Not in `public/data/spells/` |
| Primal Savagery | Medium | Not in `public/data/spells/` |
| Sapping Sting | Medium | Not in `public/data/spells/` |
| Shape Water | Medium | Not in `public/data/spells/` |
| Sword Burst | Medium | Not in `public/data/spells/` |

---

## Table 4: Extra (Local, Not in PHB List)
| Spell | Notes |
|-------|-------|
| elementalism | Homebrew cantrip |
| starry-wisp | Present locally, not PHB core |

---

## Next Actions
- Migrate Old set in Table 2 using `@WORKFLOW-SPELL-CONVERSION.md`; prioritize by play impact (e.g., fire-bolt, eldritch-blast, guidance once added).
- Add missing PHB cantrips (Table 3) to backlog and create new JSONs.
- Confirm local "Extra" entries are intended homebrew; keep but mark as non-PHB.
