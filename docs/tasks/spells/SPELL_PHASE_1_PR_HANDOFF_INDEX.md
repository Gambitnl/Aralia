# Spell Phase 1 PR And Handoff Index

This appendix holds the package lineage and handoff references that used to
live inline in `SPELL_PHASE_1_TASK_TRACKER.md`. The tracker now stays focused on
active queue state, live blockers, and update rules.

## Package Lineage

| Package | Durable spell/project references | Notes |
|---|---|---|
| Setup | PR #933 | Base task context for Jules. |
| P2 | Linear `ARA-7`; Jules session `15527431301408060204`; PR #935 | Premade party gear, combat readiness, and caster spellbook legality. |
| P3 | Linear `ARA-9`; Jules session `2823658242418460192`; PR #954 | Character creator spell selection and spellbook visibility. |
| P4 | Linear `ARA-10`; PR #979 | Deterministic combat simulator pilot. |
| P5 | Jules session `16180069342192211468`; PR #991 | AI arbitration pilot for `prestidigitation` and `suggestion`. |
| P6 | Linear `ARA-12`; handoff `handoff-1779592447710-27ufm6`; Jules session `3811311513433217520`; PR #997 | Choice/mode bucket work and local consolidation after conflicted PR repair. |
| P7 | Linear `ARA-13`; `handoff-1779669449208-owdfok`; Linear `ARA-14`; `handoff-1779674517015-2ix4kq`; Jules sessions `1595386471973519144` and `15919037371248424671`; PR #998, #999, #1000, #1001, #1004, #1005, #1006, #1009 | Atlas discoverability/source repair and bounded fallback after stale Jules output. |
| P8 | Linear `ARA-15`; draft `draft-1779683281352-agb351`; handoff `handoff-1779684300040-3qsfex`; Jules session `2655219008150635392`; PR #1020 | Bless/Bane roll modifiers. |
| P9 | Linear `ARA-16`; draft `draft-1779700777079-ju08q8`; handoff `handoff-1779700914843-jd8jhq`; Linear `ARA-17`; draft `draft-1779710504390-cfv6vz`; handoff `handoff-1779710922359-7j9l92`; Jules session `11504138994787423026`; PR #1043 | Higher-level caster fixture coverage. |
| P10 | Linear `ARA-18`; draft `draft-1779722411180-wwr4o2`; handoff `handoff-1779722482455-4913b2`; Linear `ARA-19`; draft `draft-1779725576099-ia0tqw`; handoff `handoff-1779725875825-gybpb1`; Jules session `344957924579130899`; PR #1059 | Target filters and eligibility mechanics. |
| P11 | Linear `ARA-20`; draft `draft-1779734753059-jemupd`; handoff `handoff-1779735529994-aq60x6`; PR #1072 | Status/state-change mechanics. |
| P12 | Linear `ARA-21`; draft `draft-1779743756459-8uvr0z`; handoff `handoff-1779744252464-e065rv`; Jules session `3991627368289943007`; PR #1084 | Conditional-ending mechanics. |
| P13 | Linear `ARA-22`; draft `draft-1779754729582-hqen06`; handoff `handoff-1779754985825-4yijzn`; Jules session `4325471518148676473`; PR #1096 | Terrain/surface mechanics. |
| P14 | Linear `ARA-23`; draft `draft-1779763218951-adiujn`; handoff `handoff-1779763287600-th7aze`; Jules session `16016352181102771214`; PR #1110 | Vision/light/sound mechanics. |
| P15 | Linear `ARA-24`; draft `draft-1779771507621-vox90j`; handoff `handoff-1779774561087-k9184e`; Jules session `5400768066928394476`; PR #1122 | Summon/control mechanics. |
| P16 | Linear `ARA-25`; handoff `handoff-1779867945949-gghfzz`; Jules session `11565543977884436282`; PR #1135 | Sustain/recast action mechanics. |
| P17 | Linear `ARA-27`; draft `draft-1779935690072-pzmogh`; handoff `handoff-1779984405537-9dkw7v`; PR #1140 | Reaction/opportunity restrictions. |
| P18 | `PACKAGE_18_REACTION_OPPORTUNITY_CONTINUATION_JULES_TASK.md`; `PACKAGE_18_REACTION_OPPORTUNITY_CONTINUATION_JULES_PROMPT.md` | Current continuation packet for the next bounded reaction/opportunity slice. |
| Symphony support | See `conductor/symphony/JULES_MIDDLEMAN_AUDIT.md`, `conductor/symphony/docs/tasks/SYMPHONY_OPEN_TASKS.md`, and the decision report | Workflow repairs and support history stay separate from the spell PR index. |

## Notes

- The detailed packet files remain in `docs/tasks/spells/` next to the tracker.
- Use this appendix for package lineage and stable PR/handoff references.
- Keep transient Symphony receipts, local dashboard state, and runtime manifests out of this appendix unless a short durable summary is explicitly needed.

