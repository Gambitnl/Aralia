# NPCs / Companions

## Exact player conversation transcripts

Verified: 2026-11-03.

The existing archivedBanters store retains delivered player-conversation lines. useConversation archives exact attributed words before End summarization. Summary failure and short exchanges do not erase those words; duplicate and stale closes preserve the earlier archive and replacement conversation. Exact transcripts and generated semantic memories remain separate. No new approval, promise, consent or private lore follows from an archive.

conversationTranscript carries optional known-world, participant and capture provenance. Prompt recall is bounded to two recent conversations and four lines in the same known world. Every current participant must have witnessed the historical exchange; a subset of its witnesses is allowed, while an added outsider excludes it. Legacy entries with unknown provenance and conflicting versions remain stored and displayable without entering prompt recall. Quoted words, narrator events and unanswered questions are not established facts or renewed agreement.

The existing Party Chat Memories tab displays the archive. One actual cold startup and normal Continue Journey preserve the original six-line Elara exchange in that view. The original question is visibly attributed to You; all six native accessibility lines retain order and speaker labels. New generated recall, native End-summary behavior and another save/reload cycle remain open in the owning gameplay tracker. The current UI uses a real-world timestamp and raw location identifier; world chronology and useful place naming remain a presentation gap.

See [save and load](save-load.md#loaded-player-conversations) for the load boundary and [the current companion checkpoint](../../projects/gameplay-flow/ISSUE_HANDOFFS.md) for evidence and limits.

## Delivered local directions participate in conversation recall

Verified: 2026-11-03,80 affected tests/four scoped paths0, actual Cora Talk/directions/recall, rendered inspection and38-group reload qualification.

NpcDirectionsDialoguePublication uses the existing interaction history with global_directions/local-directions provenance. processTopicSelection stamps the checked answer and full current speaker key; publishSpokenNpcReply repeats live session/topic/speaker and resolveNpcLocalDirections checks before publishing exact words. The existing lastSpokenDialogue pointer makes repeated directions the latest real delivery while preserving the first record/date. Generic recall includes them. Old journal notes/display-only answers and failed generation never become speech; authored knowledge overrides remain authoritative.

Actual Cora replay corrects last-discussion recall from an older family reply to the just-heard directions. One source note remains, her three prior records remain exact and one direction record is added. Same-life fullreload recall preserves history4/one meeting/48accounts36unread and all other NPC memories. Saved founding biographies remain unchanged; current age/office/family use the already existing life readers. A separate failed generated rumor request grants no knowledge and remains unresolved. See [the played travel evidence](../../projects/gameplay-flow/TRACKER.md#the-dedication-reaches-a-real-priest-and-remembered-directions).

## Street workers, frontage waiting and supported courtesy steps

Verified: 2026-11-03.

Roster employment can name more workers than a building's interior packet can place. createResidentStreetSampler keeps a source worker without a current indoor station on the public frontage, using workplaceWaitingSpotFor and the existing errand standing calculation. The keeper's workPlotId, employment records, schedules, household keys and names stay with their original owners. A fallback waiting target does not prove indoor attendance or create room capacity. Full physical staff-room integration remains open.

Street source targets use groundWalkHeight so a real floor slab, rather than terrain alone, supports their feet. This does not change accepted player coordinates. Later separation and movement still require the ordinary ground/water, support, door, headroom and measured-body checks. It supplies neither a private-room permission nor a passage through a tall resident.

yieldActorStep keeps its0.08m default. A street caller with a geometry-admitted step may opt into at most0.22m, matching the existing walking allowance. The route search remains within that height of its starting floor. Indoor courtesy retains0.08m and its own source-slab boundary. Invalid allowances, unavailable geometry and protected bodies still refuse movement. This avoids trapping a child at the inn's actual0.12192m doorstep without shrinking the body or granting a storey change.

Native Fianna play reaches Oroten's plot65 common room, meets its actual keeper, buys the listed supplies and pays for an unused upper guest bed. The six owned source/test paths have89 passing affected cases and clean scoped types. The exact36-group save/reload, costs, discovered hours and remaining camera/room-access limits live in gameplay-flow/TRACKER.md, A real Oroten inn arrival pays for provisions and an unused guest bed. This is not acceptance of all NPC routines, private circulation or interior rendering.

## Actual return and source continuity

Verified: 2026-11-03. Native browser reader4 reproduces all298 Sedanes founders;21 later births explain319 saved people. The earlier return mixed those people with layout2 ground and remains protected, without safe load admission. The normal map-travel path now qualifies destination identity before costs and carries source metadata through the move. A separate exact copy of the earned temple checkpoint replays the9h9m return normally on layout4/terrain2; both actual Constitution saves pass. Named23:16:59/fullreload23:19:08 preserves32 checked groups, distinct feet, memories, belongings and goals; normal Talk/Recall remembers the return and unfinished restoration. All40 primary records/33 original archives remain exact. The complete companion arc remains open. See gameplay-flow/TRACKER.md, Recorded destination sources survive the actual return and reload.

## Return-water consent

Verified: 2026-11-03. At the actual temple, a joined Elara can discuss the return to her remembered source settlement. The shared site/contact selector requires an actual arrived source leg and retained arrival memory. Trust, known home and real private water determine whether she offers a bounded extra-water share while reserving her own half-day. Offer and player acceptance are separate remembered choices. The water stays in her bag. The existing travel precheck and settlement use the intended destination to authorize only that return, then mark permission used; default private surplus is protected. Entry permission, approval, quests, personal identity and abilities remain separate.

Actual offered/accepted/recall/refusal and32-group/33-archive full reload are qualified in gameplay-flow/TRACKER.md, Return-water consent without moving belongings. Actual return spending and skill use remain next, not accepted by fixtures.

## Current owned-supply preparation

Verified: 2026-10-31 in the native2560x1249 game. After normally opening his owned Priest's Pack, Bram uses his already-prepared Create or Destroy Water once to fill its existing half-gallon skin. The real cost is one level-one slot; one dated log entry is added. The skin contributes only0.25 water-days. Elara keeps her own1/1 supplies, memories, approval15, accepted travel terms and declined entrance decision. Mechanics live in items-trade-inventory.md; the detailed receipt lives in gameplay-flow/TRACKER.md, Actual water preparation and persistent refusal.

Full document reload and explicit Load retain all32 checked groups including the cast log and32 older named saves exactly. The ordinary temple doorway still refuses entry after this partial preparation; all32 groups remain unchanged through that refusal. No visit, extra spell cost, private supply transfer or automatic agreement is awarded. This is Bram's preparation, not proof of Elara's ability use or a completed companion story. Later current-autosave Continue retains32/32 groups and all33 named archives. Native desktop inspection verifies local spellbook SVG icons and all nine inventory rows, with the full skin and spent slot retained.

Next discuss a bounded resupply/return plan to the known source town and use Elara's actual skills. Existing pooled travel supplies must not stand in for permission to spend her private goods. Keep the restoration and entrance terms, any dissent and the earned route consequences. The freeform preparation question timed out before sending; roster stranger wording, legacy images, authored appearance/held-gear presentation and historical28/31 drift remain unresolved. Restoration, combat, meaningful disagreement, return consequences and separation/reunion remain open.

## Conversation input isolation and current reload

Verified 2026-10-29 with actual native 2560x1249 play. A recorded S key held about 217 ms moved Bram 0.080772 m while the conversation was open. A separate pointer-only replay kept logical and rendered feet exact through idle, To Player, Talk and recall, with no new movement keys. This confirms a conversation keyboard leak but does not explain the historical 28/31 reload mismatch.

The existing World3DWrapper reading/rest commitment now includes active conversation. It clears pending movement and removes the ground input/report callbacks while talking, preserving ordinary walking when the conversation closes. After a controlled refresh of only the owned no-watch server, a native S burst of about 125 ms leaves both saved feet and the Scene's actual rendered footfall exactly unchanged. Closing then permits accepted walking again (0.0336804 m in the observed short burst). The immediate post-click read preceded the asynchronous close; the settled post-key observation confirms closed conversation and restored input. No position or source geometry was rewritten to obtain this result.

The doorway now explains Elara's current refusal instead of asking the player to discover a discussion already held. The actual text identifies Bram's missing food and water for the way back. Its desktop error panel is 760 px wide with 16 px text, raised above the movement hints. Native before/after conversation and doorway screenshots were inspected. Supporting checks: 16 affected cases across two suites pass after two baseline behavior failures. An intermediate run exceeded its import/test time under load; a stable conversation fixture reference and the subsequent complete run pass. Four scoped type paths report zero errors and zero suppressed diagnostics. Scoped header sync leaves both source headers unchanged and five dependents unwritten.

Normal save Bram Elara Conversation Guard Verified1793282330687 has SHA-256 df3caffccbdb98052b10fa14b9c40a6f60580122bb3a45b36193e4786acf596d. Full document reload and explicit Load retain all 31 checked live groups exactly, including player and companion footing, refusal, class resources and belongings. All 29 older named payloads remain byte-exact. Loaded native input trace contains only the two Resume/Load button gestures and no movement key. Current player feet are 457.28093006816067 / 457.28093006816067 / Y29.946181554373762 in cell3385. Ignored proofs: conversation-input-repaired-native.proof.json, conversation-guard-reloaded.proof.json and cached-pointer-routing.proof.json. This qualifies the current checkpoint; the earlier 28/31 mismatch remains historically unexplained. The cold load succeeds but does not promote another owner's ground-edit feature or its geometry.

Normal return-preparation inspection opens Bram's actual shared inventory: the Priest's Pack has no Review/Unpack control. Existing AdventuringPackReview and the owned-bundle transaction support only the Explorer's Pack manifest. The held Priest's Pack describes two rations and a waterskin; the generated glossary's different seven-ration description must not silently replace it. A waterskin is a vessel, not free drinking water. This shared manifest gap is coordinated with the economy owner; no duplicate pack system or supplies were created. The existing food-forage producer is tied to an underprovisioned journey commit, while its pure module also models water. Ordinary camp preparation and a meaningful companion-led skill action still need actual gameplay and any necessary extension of those existing systems.

Next: obtain legitimate return supplies, reusing the owned pack workflow and world-backed preparation actions. Elara's higher Wisdom may make her the useful forager, but no skill result has been played or forced. Retain her 1/1 supplies and her refusal until both people reconsider after real preparation. Monitor spatial continuity; do not call historical drift fixed from the new positive replay. Actual abilities, combat, restoration choices, disagreement, return consequences and separation/reunion remain open. The full companion arc remains active and unaccepted. Use the shared Planmap Project progress entry and existing canonical records.



## Actual entrance refusal and shared Planmap entry

Verified 2026-10-29 in the native 2560x1249 game. At the reached temple, normal Talk and Discuss entering the temple together produce a refusal: Bram has no complete day of food and water reserved for the way back. Elara retains her own 1/1 supplies and restoration ambition; her accepted travel agreement remains accepted. The new entrance-floor discussion is declined and adds exactly one significant event memory. Normal Enter Dungeon refuses before mounting or recording a visit. No supplies, trust, treasure, spell use or quest completion are granted to obtain agreement.

The existing travel-choice reducer/UI now support discussion, conditional offers, explicit acceptance, staying outside and recall. Source-bound context checks the joined person, disclosed goal, world, cell and physical contact. Current exhaustion, serious injury, trust and owner-only return meals inform the answer without reading hidden encounters. Doorway checks the current answer and readiness; the existing descent handler enforces the offered entrance-floor limit. Offers, mutual acceptance, changed-readiness refusal and descent limits are fixture evidence only. Supporting checks: 37 cases in four affected suites; six scoped source paths and final three decision/test paths report zero errors and zero suppressed diagnostics. The header wave updated six files; two transient UNKNOWN write-open failures passed a bounded retry after the owned server released its old handles. Dependents stayed unwritten.

Normal save Bram Elara Entry Refused1793279174763 has SHA-256 b56225d7f3e5fe5d2555f1eb61ccdc84ff339fdc44602adfa96500147de94cb8. Full document reload/explicit Load proves the exact refusal, terms and memories plus all 27 older named payloads byte-for-byte. Of 31 checked live groups, 28 remain exact; companions, playerGroundPos and playerCell differ. Elara moves about 3.3 cm in X and her trail gains two points while player footing also shifts. This is NOT exact spatial continuity. No pose or source geometry was changed to conceal it. The old-to-new save also changes discoveryLog and npcMemory around the actual conversation; those additional records need qualification. Ignored proof: companion-journey/site-refusal-reloaded.proof.json, site-risk-actual.txt and native refusal/entry screenshots.

The normal progress entry is now /Aralia/planmap/index.html?view=project-progress, with an optional focus=companion-journey-focus. It embeds the SAME ignored snapshot at full desktop width, with no copied statuses or new data store. The canonical records retain authority. Parent native2560x1305 inspection verifies the 2560px iframe, Back, explicit reload and missing-artifact fallback; canonical record links return actual Markdown. Independent peer checks also qualify the HTTP200 game-shell fallback. Existing Planmap Companions narrative is refreshed without promoting its status or features. Agora's separate four-column registry intake problem remains WF-G367; the concurrent WF-G368 is marked duplicate.

Next: diagnose idle/load footing drift and improve the doorway's generic refusal explanation before another entry attempt. Then address Bram's actual return-meal shortage through gameplay and revisit the decision; do not donate Elara's goods or force agreement. Real companion ability use, restoration choices, disagreements, return consequences and separation/reunion continuity remain open. The full companion arc and GF-G08 remain unaccepted.



## Actual owned rest and earned cleric resources

Verified 2026-10-29 through the native 2560x1249 game. The rest preview now explains that Elara eats from her own bag and Bram has no meal. One normal confirmation advances 0351-01-04T04:14:46 to 12:14:47. Elara's private rations and water each fall from 2 to 1; none feed Bram. Her HP recovers 8/10 to 10/10, cleric slots 0/2 to 2/2, and Magic Initiate use 0/1 to 1/1. Both travelers' exhaustion clears under the saved 2024 rules. Shared inventory, 17 gold, source feet, quest, Elara's identity, relationships, goals and other companion fields remain unchanged. No ability was cast and no deeper entry was attempted.

The existing LONG_REST reducer and modal share a pure meal planner. Complete private meals feed their owner; shared supplies can cover all remaining travelers' shortfalls. Incomplete meals consume neither resource, absent people are excluded, and denied/downed members keep their private supplies. Shared-only parties retain their existing all-or-nothing pantry behavior. Existing rest admission, spell preparation, cooldown, clock advance and rulebook recovery paths are preserved. Supporting evidence: 38 cases across four affected suites pass; five scoped type paths report zero errors and zero suppressed diagnostics. One scoped header wave updated three files, left one unchanged and four dependents unwritten. Native rendered preview was inspected; no horizontal overflow.

Normal Scribe creates Bram Elara Owned Rest, timestamp 1793276583050, SHA-256 7c8741e2e383c93bd43c0103f57989a271c0d322907496cb5562e8f0d12ec2f8. Full document reload and explicit Load retain all 31 checked live groups exactly and 26 older named payloads byte-for-byte. Actual saved time is 12:15:44 and lastLongRestAt is 12:14:46. Ignored proof: companion-journey/owned-rest-reloaded.proof.json, owned-meals-actual-rest.txt and owned-meals-rest-preview-desktop.png.

Next: discuss and record the temple's deeper risks together, then use actual companion abilities in exploration and combat. Guidance still needs a chosen skill with mechanical scope; Light needs a real object target and illumination. Private supplies are not consent to feed others. Personal story choices, disagreement, return consequences and separation/reunion build continuity remain open. This rest milestone does not complete GF-G08 or the companion arc.



Elara's explicit cleric choices are now available and persistent (verified 2026-10-29). The existing pure Character Creator assembler supplies Protector, Medicine and Persuasion, Acolyte's Insight and Religion, Human History, Healer and Magic Initiate. Her retained scores, chain shirt, shield, mace, HP 8/10, exhaustion, identity, goals, private bags and relationships stay unchanged. Native 2560x1249 inspection shows Medicine/Insight +4, spell DC 12 and attack +4, five cantrips and four prepared level-1 spells. Newly recovered pools start at 0/2 slots and 0/1 feat use; no ready casts, healing or provisions are granted by Load. Saved class-choice markers prevent repeat assembly. Existing class choices or progressed characters are skipped, and the saved rulebook prevents applying this 2024 profile to 2014 campaigns. The profile stores spell IDs; the shared assembler now accepts ID-only selections without bundling public spell JSON or duplicating spell details. Creator runtime assembly rules are unchanged. The Skills tab now uses two readable nine-row tables across the desktop sheet; all 18 skills fit. The malformed Level level_1 label now reads Level 1. Both rendered repairs were inspected, with no document overflow. Supporting checks: 56 capability/edition cases, 7 sheet cases, final 16 capability/creator rerun, final four capability type paths and three UI paths with zero errors or suppressed diagnostics. Earlier imported diagnostic was resolved in the shared typed spell wave; it was not an in-scope capability error. Narrow header waves left dependents unwritten.

Normal Scribe and full document reload/explicit Load preserve all 31 checked groups exactly and 25 older named payloads byte-for-byte. Actual slot: aralia_rpg_slot_Bram Elara Cleric Choices Pending Rest11111111111111111111111; timestamp 1793272900916; SHA-256 35eec31406bb2f6fa58964a0a3130dbd1dd9e0f40c60c976fed7484669a85ac5. The trailing 1s were observed in the saved label despite the intended input; cause is unqualified and the original entry is preserved. A cold-page Resume observation timed out, then the same live page rendered normally; no restart was justified by that timeout. The actual suffixed entry was loaded through normal controls. Proof: ignored companion-journey/actual-class-capabilities.proof.json and cleric-choices-reloaded.proof.json; native captures include cleric-skills-wide-desktop.png and cleric-overview-slots-final-desktop.png.

This qualifies class choices, desktop presentation and continuity, not actual ability use. No spell, skill check, rest, deeper entry or combat was performed. Guidance still needs a chosen-skill control and mechanical scope; names-only Light without a real object target or illumination is not accepted. Elara's private food is not blanket permission to feed the party. Next: play legitimate preparation using owned supplies and normal rest, repair per-person meals or explicit sharing as needed, then mutually evaluate the temple's deeper risks and use real companion abilities in exploration and combat. Restoration, disagreement, return, separation/reunion build continuity and the complete arc remain open.

The retained met build is now played and persistent (2026-10-29). Elara's desktop sheet shows her saved scores 13/12/14/8/15/10, AC 16, chain shirt, shield and mace. Her HP stays 8; only the correct maximum changes from 8 to 10. Exhaustion, hit dice and spell resources are not refreshed. Age 32 and Acolyte now render from her existing authored biography. The guarded load recovery accepts only the unchanged level-1, zero-XP legacy placeholder with a matching met NPC; customized or progressed builds are skipped. A saved version marker prevents later losses, sales or injuries from restoring the old build again. On the actual normal Load, only six Elara character fields changed; the leader and all 30 other checked state groups remained exact, including her complete companion identity, goals, bags, memories, terms and approval 15. The normal Bram Elara Retained Met Build save1793269847216, SHA-256 482c52ddab934869637147b84e26142c76998efd5b002a1f2fde55e5e3cdae27, then survived full document reload and explicit Load with all 31 groups exact and all 24 older named payloads byte-exact. Native 2560x1249 sheet inspection confirms the recovered build. Proof lives in ignored companion-journey/actual-retained-build.proof.json and retained-met-build-reloaded.proof.json. Recruitment conversion has 68 affected passing checks; recovery has 10 regressions including serialized root Load and once-only behavior, plus 9 existing presence checks. Scoped types and both narrow header waves passed; dependent files were not written. New recruitment itself remains fixture-qualified; the already-joined recovery is actually played. Class spellbook, skill proficiencies, unresolved class choices and actual skill/combat use remain open. So do explicit supply sharing, meaningful deeper-risk consent, restoration, disagreement, return and the complete arc. The rendered hair/appearance and authored half-plate prose versus retained chain-shirt record remain presentation/provenance gaps. Next: extend existing class assembly and casting systems to give the retained person a coherent cleric build without refreshing earned resources, then play preparation and mutually agreed risks. No rest or dungeon entry was committed in this pass.

Actual shared-journey speech and reload (2026-10-29): normal Talk and Recall our shared journey now name the real 17-hour, 18-minute march, the unfinished restoration, mutual risk decisions and Elara's actual exhaustion/rest preference. Both were played again after a full document reload. Native 2560x1249 screenshots were inspected; the existing wide two-column conversation remains desktop-sized, with document width 2560. Complete companion records, party, inventory, gold and quest log remain exact across recall, with approval 15 and no extra memory or reward. The normal Bram Elara Remembered Temple March save1793268155481, SHA-256 25f86d7b1ac96fba2b236435b43bbdb32bd0b3e7ae5e79b16464d81c94676b68, reloads all31 checked groups exactly and preserves22 older named payloads byte-for-byte. The preceding Capability Review also reloads31 groups exactly. Proof: ignored companion-journey/remembered-march.proof.json. This qualifies spoken memory, not enforced deeper-risk consent. Actual rest review reports no party meal from the empty shared bag while Elara retains2 rations/2 water-days. Her own provisions are not automatic consent to feed everyone; ownership and sharing must be made coherent before pooling rest costs. No rest, wait, resource grant or dungeon entry was committed. Her skeletal cleric mechanics, presentation likeness, skill/combat use, personal story consequences and return remain open. Next: repair the existing authored promotion/class-capability path without overwriting the met person or refreshing earned resources; then play meaningful preparation and deeper-risk consent.

Actual desktop capability review (2026-10-29): Elara's played character sheet shows six ability scores of 10, HP 8/8, AC 10, empty equipment slots, no Spellbook tab, blank age and Background None. Her retained met NPC already has scores 13/12/14/8/15/10, maximum HP 10, AC 16 and a chain shirt, shield and mace. The authored promotion currently discards that mechanical record. Authored age 32 and Acolyte identity remain authoritative; generated age 45 and the dev fixture's age 24 are not biography evidence. Existing dev cleric spells are unfinished intent, not played capability. Repair must preserve earned HP, exhaustion, supplies, relationships and private goals; do not regenerate her or award free healing, equipment or spell resources. The normal checkpoint is Bram Elara Temple Capability Review, timestamp 1793267361946, payload SHA-256 60bedf9c390f55210f68286eec19244fb703c764f6d9d22addd748c0cb7c5d98. Scribe and archived payload are verified; this newer checkpoint's full reload remains pending. Evidence: ignored companion-journey/elara-skeletal-character-sheet-native-desktop.png and temple-capability-review-storage.json. Desktop is the product target; no mobile-pane acceptance work.

Verified: 2026-10-29 (actual desktop Phu public entry, walking and meeting reload; complete companion arc remains open; spoken work recall and three exact reloads); desktop Notice Board chronology and nine exact reload groups; reciprocal living-family dialogue and exact desktop reload; independent public activity placement and desktop source meeting/reload (2026-10-29); shared family inspector/profile and exact desktop reload; visible-part arrival clearance and two actual desktop reloads (2026-10-29); source-aware crier report chronology and saved-log memory (2026-10-29); dated gossip and saved six-game-hour source hearing (2026-10-29); saved institutional roles and actual Faelan household view (2026-10-29)

## Purpose

This domain covers the companion, NPC, dialogue, and relationship-management surfaces that drive party commentary, NPC state, generated dialogue topics, and character-facing social systems.
The current repo shape spans data, reducers, systems, hooks, services, and UI entry surfaces rather than one single companion module.

## Verified Entry Points

- src/data/companions.ts
- src/systems/companions/
- src/state/reducers/npcReducer.ts
- src/state/reducers/companionReducer.ts
- src/state/reducers/dialogueReducer.ts
- src/hooks/useCompanionCommentary.ts
- src/services/dialogueService.ts

## Current Shape

### Saved presence and witness boundaries

`appReducer` restores the validated local dynamic-NPC list saved at the loaded
location. Known NPC/companion records alone do not establish presence. Party
members are excluded from the local encounter list, and a saved empty list does
not reroll into a new meeting. Older saves without a list retain the existing
static-location fallback. A later save whose list was already erased is not
repopulated from retained relationships. Focused full-load fixtures preserve
identity, goals and memory. Actual Mara/Serara manual-save/full-reload replay
retains both people, a meeting, public ambition and refusal; see the
[Gameplay Flow tracker](../../projects/gameplay-flow/TRACKER.md). Independent
whereabouts after departure and natural separation/reunion remain open.

`BanterManager` and `useCompanionCommentary` require active party membership for
party reactions. A pending generated reaction is dropped if its speaker leaves
or the scene changes before it returns. Retained relationship and goal records
remain available; retaining them does not grant remote witness knowledge. This
boundary has focused tests, not a played dismissal/reunion acceptance.

The save-menu backend-readiness repair lives in
`services/saveLoad/saveLoadHelpers.ts` and `saveSlotIndex.ts`. It preserves
IndexedDB slot listings during cold initialization; it does not alter NPC or
save payload contents.

### Direct dialogue meetings

The companion branch of `handleTalk` records first meeting and interaction
recency through the existing NPC memory owner before optional AI work. Its
authored greeting uses identity and public active goals, with 1.5-second model
discovery and eight-second generation bounds. A late optional result has no
gameplay writer after its deadline. Private goals are omitted. Only public
ambitions actually spoken become discovered facts. An authored companion's
refusal becomes an event memory without an approval change or forced join;
later greetings can acknowledge that invitation. Actual manual-save reload
and repeat Talk verify this authored recall. Free-form model conversation,
earned recruitment, skill use and personal quest consequences remain open.

`promoteCompanionToMember` now derives its default class from the authored
identity. Elara remains a cleric and Kaelen a rogue in conversion fixtures;
explicit overrides and the character factory's unknown-class fallback remain.
Promotion keeps the identity, goals and relationship objects. This corrects
class loss without establishing a complete skill loadout or earned recruitment.

The conversation panel bounds intent reading to 15 seconds. An unavailable
reader returns the unsent words to the input and permits retry or exit. A late
classification cannot apply an action after timeout or panel closure. Replacing
the active conversation releases its reader lock and ignores the former result.
Nine focused UI cases pass; both changed paths pass scoped types with zero
errors or suppressed imported diagnostics. Actual Elara gameplay exposed the original hang at
"Reading your intent…" before the question reached her. After full document
reload and normal Load of the exact 10:46:25 manual Chronicle, the same question
receives the recovery message, stays editable, enables Send and Exit, and closes
through normal End Conversation. Desktop and 390x844 phone renders are readable
without horizontal overflow. No answer, quest location, approval or promise was invented.

Final-source normal Talk to another person during that conversation receives
the existing already-in-conversation guard. Normal End Conversation then Talk
to Kaelen opens his public rogue introduction with an unlocked empty input.
Replacement-reader protection is fixture evidence, not a played direct switch.
Race fidelity was subsequently repaired at the species boundary; see Species
and cast captions below. Full likeness and played racial skills remain open.

`handleStartDialogue` records the first meeting for an existing town resident or
authored NPC as well as for an NPC generated on contact. It uses the existing
action-memory matrix before opening the session. A returning NPC retains the
original meeting fact and receives an updated interaction timestamp. The focused
action-handler suite verifies these paths. Bounded saved physical meetings and
authored companion recall now have gameplay proof; model-generated recognition
still needs it. See the [gameplay flow tracker](../../projects/gameplay-flow/TRACKER.md).

### Shared accounts and staffed meetings

The staffed-success branch of handleOpenDynamicMerchant uses the existing
action-memory matrix and metNpcIds for first contact. Town registration alone
does not mean the player has met the keeper. Repeat visits preserve the first
fact and refresh recency; attendance refusal creates no meeting. Trade ownership
and prices remain separate. Actual Tomas play now verifies meet, paid account,
saved contact and later recognition; four real-reducer integration cases cover
legacy missing memory, returning contact and attendance refusal.

companionRumors selects ordinary retained rumor/lead receipts and a companion
actually present in the active conversation. companionRumorReducer revalidates
the exact inventory entry before recording one attributed hearsay event with
source ID, quotation, reporter and world. Repeated reading adds dialogue without
duplicating the memory or awarding trust. Private goals, party membership,
inventory and quest progress remain with their owners. CompanionRumorChoices
exposes this deliberate action beside free text; it does not interpret arbitrary
words as successful speech or an agreement. Public personality/goal data informs
the spoken opinion. Discovered preferences are not yet mechanical travel terms.

Actual Mara paid4 GP for the Iolodidau flooding account, showed it to Elara and
heard her need for a safe approach and return plan, alongside her restoration
aim. Normal named save, native full reload and Talk recall the account while
preserving the kept promise, personal supplies and approval2. The site remains
hearsay, not a confirmed route or the unlocated Temple of the Morning. The panel
scrolls the latest message into view before follow-up cards; actual desktop/390
replay confirms the whole reply is visible. See the Gameplay Flow tracker for
payload hashes, tests and the continuing story gaps.

### Direct-contact provenance gate

Actual body selection and account sharing set Kaelen's met flag, but the
preserved Mara Two Independent Opinions payload contains only Elara's older
gossip about meeting Mara. Text-only deduplication discarded direct confirmation,
and repeat Talk skipped recording because the met flag was already set. That
failed payload remains unchanged; it does not prove firsthand continuity.

The implemented repair checks for a retained direct meeting independently of
the met flag. On actual contact, it keeps old attributed gossip and records one
direct confirmation at current game time. A matching legacy direct fact gains
its missing key without changing its original ID or date. Future propagation
names the original person who met Mara and uses player_met_npc:<originId>,
rather than claiming that the recipient met her. Fact dates remain milliseconds;
day-based availability stays separate. Existing stored gossip is not rewritten
or assigned an invented historical first-meeting date.

Eighty-four affected cases pass across bounded runs, including existing merchant
trade regressions. Nine scoped files and a three-file follow-up have zero type
diagnostics. The five-source dependency-header pass updated three files, left
two unchanged and reported five dependents without writing them.

Actual cold replay now passes. The earlier independent smoke captured a shared
GameOverScreen import failure. After both served modules returned 200, normal
named Load reached the exact saved world. A separate blank-tab reload mistake
was diagnosed and is not game-load evidence. Normal visible-cloak contact and
repeat contact opened Kaelen's remembered account. Mara Direct Meetings
Remembered (SHA256 89d1f9998f9fcb76e86491fca2f0eb6543f5c9a0fae95b5bed30b1c7a8d7b591)
retains one direct fact. Full document reload, exact named Load and another real
visit produce the same recall. Mara Direct Meetings Reloaded (SHA256
1040556b63ee41505b57919ca2e7b69ce62f58b619b22e7389e6b93414b170c2)
keeps that fact's ID, date and all fields exactly, alongside unchanged old gossip.
Both entire companion records, party, inventory, quests, gold, seed, location,
body and local people match the two-opinion baseline. Original default and failed
payload hashes remain exact. No trust, recruitment or quest reward was granted.
Actual report propagation to another speaker is still fixture evidence only.

SceneCastNameplate now exposes a compact native Talk button only for a cast
member whose body is already interactive. It calls the same onSelectNpc path;
the player and handler-free dioramas remain inert. Primary body selection and
right-button body camera gestures remain. Native keyboard activation uses the
button; Enter/Space events do not bubble into world movement controls.

Actual phone pointer opens Elara and recalls her invitation, kept promise, owned
2/2 supplies and attributed account. Actual Enter and Space separately open
Kaelen's retained account. Normal exit works each time. Both desktop and phone
captures were inspected. An initial phone render exposed overlap with the player
warning; revised packing reads existing name/footing/water rectangles from the
actual world layer and avoids them. No actor, camera or world point is changed.

Mara Clear Companion Conversations, timestamp 1793210602110, SHA256
0e9956450b10105cb1c2710b5b4b6f5534f796a195e0296b558e2650ecff2878,
retains complete companion records, direct fact/date, old gossip, party, inventory,
quests, gold, seed, location, body and local people exactly. The original default
and failed two-opinion save remain unchanged. This final UI save was inspected;
the preceding 1040 Chronicle supplied the actual cold-load input.

Seventeen distinct affected cases pass across bounded runs. Five scoped paths
and a three-path overlap follow-up have zero diagnostics; final SceneCast-only
confirmation also passes with zero diagnostics and zero suppressed imports. Initial sandbox EPERM and an unavailable test-only
library were corrected before acceptance. The three-source header pass updated
two/left one unchanged; the follow-up left two unchanged and reported three
dependents without writing them. The final independent smoke reaches title.

The latest cold camera places the view above terrain while retained actors are
obscured and nameplates remain visible. The camera owner received this observation.
Do not infer full physical meeting, source support, route, performance or a clean
console from UI acceptance. The next story dependency is genuine public-goal
world provenance and discovery, not invented connections to the bought sewer.

### Species and cast captions

RichNPC.biography.raceId optionally retains the canonical species chosen by
npcGenerator. Older untyped NPCs retain the existing Human fallback; no race is
guessed from description prose. recipeFromRichNpc accepts the authored race as
a legacy companion-shell override, and World3DWrapper supplies that known
identity. The renderer then uses the existing species profile, gear and stable
NPC seed. Actual saved Kaelen now resolves a Tiefling Rogue with horn and tail
parts at his unchanged source point. Appearance palette, scars, hair and full
likeness remain separate from this species repair.

createPlayerCharacterFromTemp accepts an optional known race while preserving
legacy callers. Existing racial movement, darkvision and spell-grant helpers
derive that base; unresolved lineage choices remain unresolved. Both generated
NPC conversion and authored promotion carry species into the playable and
relationship records. Authored identity, goals, inventory and memory persist;
generated biography keeps its actual family. Thirty-six focused cases cover
these paths. This is conversion evidence, not an earned join or played senses,
spells, proficiencies or a complete companion loadout.

SceneCast uses fixed-size captions like PlayerAvatar, so a close camera orbit
does not enlarge names over faces. Primary body clicks still speak; right-button
gestures pass to the camera. Actual primary Talk/normal exit/right gesture and
desktop/phone label size are verified without body movement. Phone-edge clipping
then prompted sceneCastLabelLayout: it projects existing anchors and fits caption
rectangles in stable order inside the viewport. It changes no actor, camera or
world point. The final native Talk and obstacle-aware placement above supersede
the passive-caption baseline. No overall 3D or footing acceptance
follows from these reading and selection repairs.

Actual subsequent Kaelen discussion of the same retained account produces his
own practical terms while Elara's cautious account remains separate. No debt or
other private goal is revealed, and no terms become a travel agreement. The
new two-opinion Chronicle and subsequent direct-meeting saves now pass actual
cold recall, with both account memories unchanged. See the
Gameplay Flow tracker for exact payload proof and continuing goal-source gaps.

### Current desktop target and authored destination source

The product target is desktop gameplay and the desktop 3D experience. The earlier
mobile-target detour is historical evidence, not a requirement. The touch-only
44-pixel nameplate expansion was removed; native pointer/keyboard behavior and
player-notice avoidance remain. Sixteen current cases and four scoped paths
pass. Actual 1440 by 900 replay uses compact 24-pixel labels: pointer opens
Kaelen's account recall, Enter opens Elara's invitation, kept promise, own 2/2
supplies and account. Both renders were inspected and normal exit works.

Mara Desktop Conversations, timestamp 1793214516417, SHA256
4b08e191edd04e3faf8e9117e8c46e460917c1d11f53dd584b451e99a3253f37,
preserves eleven state groups, every retained NPC fact and nineteen historical
payloads exactly. HP 12, gold 8, Mara alone, body and complete companion records
are unchanged. After closing a disposable browser, reopening had empty storage.
The exact real gameplay backup was restored into a new persistent task profile;
all 24 records deep-compare before replay. This restored continuation is not
independent persistence proof. Earlier direct-meeting native reload proof stands
separately. A cached currency producer later blocked Talk; served code lacked
the new export while disk and owner were stable. One controlled private-server
refresh served the export and the actual same-save desktop replay passed.

authoredCompanionSitesForWorld adds one distinct public-goal source after the
existing site registry. It reads canonical land, river, neighbor, burg and marker
data on a new versioned seed stream; no player or party input chooses the place.
Unavailable geography gives no invented fallback. Existing site records are not
renamed. The new frozen source names the Temple of the Morning undercroft and
its order, and retains the complete atlas seed. New authored receipts require
that full source context. Old interiors keep their existing uint32 branch.
The lore owner consumes the same prior draws and supplies the new source name
only when explicitly present. This undercroft is not a completed surface temple.

Fifty-seven distinct affected cases pass across bounded runs; six scoped paths
have zero diagnostics or suppressed imports. Pre-change Node fixtures retain
75 site records and nine selected generated plans by deep content comparison.
Only stats.genMs, a measured execution duration, is excluded. All five source
headers updated; 47 dependents were reported without writing them. For Mara's
full seed, the candidate is cell 4414 near Neapodes (burg 164), one land-graph
step from that settlement. That is construction context, not a traveled route.
Public disclosure, player quest commitment, physical discovery, hazards and
restoration are still unplayed. [ADR 11](../../adr/0011-authored-companion-world-sites.md)
remains Proposed. No companion goal, trust, party or save was changed by fixtures.

The foundation-only phase above is historical. Public disclosure and the
Available-offer integration are now implemented and played as described below.
The larger restoration, earned travel, skills and physical approach remain open.

### Authored preparations chapter

`systems/companions/companionPreparations.ts` describes Elara's first authored
preparations chapter. Its quest template lives in `data/quests/index.ts`.
`state/reducers/companionPreparationReducer.ts` delegates quest/journal changes
to the existing quest reducer and handles the explicit promise or handover in
one state update. The conversation panel exposes its fixed choices alongside
free text; these fixed effects do not classify arbitrary words as successful actions.

A promise persists in the companion's questline and event memory at game time.
Declining before promising changes neither inventory nor approval. A handover
splits the real ration/water stacks into `Companion.inventory`, completes only
the preparations quest, and grants a modest 5 approval. It neither recruits the
NPC nor completes temple restoration. Withdrawn promises retain their history.
Authored messages mark their memory as handled, so ending the conversation does
not request a duplicate AI summary or a second trust award for the same deed.
Personal belongings remain on the companion record through promotion/dismissal
fixtures. Independent provision consumption and actual party use remain unqualified.

Actual Mara play now covers offer, decline, promise, withdrawal, renewed promise
and real handover. Withdrawal abandons the quest and costs 3 approval. Renewal
reopens the same quest; handover completes only preparations and leaves net
approval 2, Mara with 3 rations/3 water-days and Elara with 2/2. Original goals
remain unchanged and no party membership is granted. Separate named open,
withdrawn and supplied Chronicles fully reload, retain both local people, and
produce the matching factual greeting. Read-only payload checks retain all five
event IDs/timestamps and transferred item attributes. Full source-linked temple
restoration, earned travel, actual skill use and reunion remain open.

The first named promise save exposed a separate presence loss:
SET_GAME_PHASE(MAIN_MENU) erased the encounter list before Scribe Entry. The
root phase repair preserves existing placement through Main Menu and still
clears it for character creation. Eight focused presence tests and actual
three-stage named reloads verify the repair. Historical null placement is never
reconstructed from relationship records. The original manual Chronicle and
failed named payload remain unchanged evidence; see the Gameplay Flow tracker.

Actual desktop/phone chapter renders also exposed background text through the
conversation. The existing reading surface now uses opaque gradient colors.
Fresh named-load renders at 1440 and 390 pixels verify readability and phone
fit. This does not qualify the still-occluded 3D meeting or body support.

### Durable companion whereabouts

Companion.whereabouts records an actual source world/cell and optional physical
point. gameEntryReducer records explicit placement; MOVE_PLAYER retains actual
outgoing local companions and resolves destination presence from that source.
Known relationships and old promises alone never provide placement. Existing
saved null/empty encounters remain unchanged on load. A party member is excluded
from local presence. Separation uses the party's actual place in fixtures.

World3DWrapper checkpoints the initial production cast point once through
RECORD_COMPANION_POSITION. The reducer rejects stale world/location callbacks,
absent NPCs and nonfinite points. SceneCast keeps explicit positions; the wrapper
translates retained world coordinates into the current scene origin. Current
fixtures cover changed-origin translation. A separate actual named physical save
and full reload retain both rendered roots at the saved points. The normal
loader uses saved ground X/Z for this origin; no separate origin publication
was available in the default scene mode. Physical departure/return is still
unaccepted. No independent schedule or onward travel is implied by placement.

Actual normal Serara/Pydria travel now verifies source-cell continuity through
an away named full reload, ordinary return and another named full reload. Elara
remembers the kept promise, owns2/2 supplies and remains outside the party. The
initial failed return payload is retained. Cold 3D entry also moved only Mara
vertically from 6.166488720703125 to 3.8723420020916612 through the existing
footing initializer. The companion agent applied no position override. Current
under-deck/water presentation and renderer warnings remain failures; complete
physical reunion is unaccepted. See the tracker for hashes and 61-case limits.

### Companion systems lane

This pass verified the current companion-system subtree under src/systems/companions/, including:

- BanterManager.ts
- CompanionReactionSystem.ts
- RelationshipManager.ts
- the current companion test suite under src/systems/companions/__tests__/

### Commentary and dialogue lane

This pass verified:

- src/hooks/useCompanionCommentary.ts
- src/services/dialogueService.ts
- src/services/EntityResolverService.ts
- src/services/CharacterAssetService.ts

The live commentary hook is still a meaningful domain entry point, but it is only one part of the larger NPC and dialogue lane.

### Data and typing lane

This pass verified:

- src/data/companions.ts
- src/data/banter.ts
- src/data/world/
- src/data/villagePersonalityProfiles.ts
- src/types/companions.ts
- src/types/companion.ts
- src/types/dialogue.ts
- src/types/memory.ts

## Important Corrections

- The old doc treated the domain as a mostly flat ownership inventory. The current repo has a real companion systems subtree and a broader supporting dialogue and entity-resolution lane.
- Organization-service and faction utility paths may intersect with NPC systems, but they should not be treated as core companion ownership just because they appear nearby in social gameplay.
- This doc should describe verified NPC and companion infrastructure without pretending that every social, faction, religion, or settlement helper belongs entirely to this domain.

## Tests Verified In This Pass

- src/systems/companions/__tests__/BanterManager.test.ts
- src/systems/companions/__tests__/CompanionReactionSystem.test.ts
- src/systems/companions/__tests__/CompanionSystem.test.ts
- src/systems/companions/__tests__/RelationshipManager.test.ts
- src/services/__tests__/dialogueService.test.ts
- src/services/__tests__/EntityResolverService.test.ts

## Current Interpretation

Re-verified on 2026-03-11.
Treat this domain as the NPC plus companion plus dialogue lane: companion systems, NPC state, dialogue topic logic, and the supporting data and entity-resolution surfaces that keep those interactions coherent.


## Failed NPC replies

Verified: 2026-11-05 for typed speech preparation and cancellation. Forty-three affected cases pass after meaningful baseline failures; eight scoped paths have zero errors or suppressed imported diagnostics. A single dependency-header wave updates two source headers, leaves two unchanged, skips four tests absent from the graph and leaves nine dependents unwritten.

The desktop panel shows Preparing reply and keeps Cancel reply available during preparation and generation of typed speech. Cancellation retains the exact draft and adds no unheard exchange. End Conversation remains available. Authored topics keep End and voice-only retry, so stopping speech cannot repeat a paid or rolled choice. Actual cold-loaded Loran play verifies both preparation cancellation and warm generation cancellation with network ERR_ABORTED and unchanged heard memory. A separate actual attempt outlived a105-second automation wait and later produced a new heard reply; do not call that attempt cancelled or count the automation timeout as a service timeout. Preparation latency and general reliability remain open.

Loran's generated vendor name was absent from his prior supplied profile/context and the known generated NPC records. Both generated answers repeat that unsupported name. The existing memory stores them as quotations, not a merchant, route or established fact. Normal family speech remains source-backed. Successful transport and persistent speech do not establish factual grounding. See the current gameplay-flow checkpoint for exact saves and evidence.


The legacy topic controller resolves a choice and records its outcomes before asking for speech. A generation failure now appears as a recoverable error rather than NPC dialogue. Retry requests the stored response prompt only; it does not process the topic again, repeat a check, charge again, or record another choice. The existing End Conversation control remains the exit. Authored graph choices keep their existing route.

DialogueInterface owns each pending request. Closing or changing speaker aborts its signal, and useDialogueSystem checks lifetime, identity and request order before publishing SET_LAST_NPC_INTERACTION. Typed speech first uses the selected local task's existing bounded preparation stage; the Groq route skips local preparation. Preparation error or cancellation stops before generation. The same signal reaches generation, and an aborted local request does not start the existing Gemini fallback. Authored topic generation keeps its existing route and paid/rolled outcomes. Missing speakers, missing personality context, unsuccessful provider results and empty output reject explicitly. A remembered opening line is used only when lastInteractedNpcId matches the current speaker. Model/provider defaults and the normal generation timeout stay unchanged.

Earlier verification covered37 distinct cases across eight affected suites and seven scoped source/test paths plus the existing declaration twin. Two hook cases failed before the repair. The real reached Roban session produced two aborted local requests and a clear error with Retry. Read-only autosave evidence retains the original16:23:39 topic timestamp, exact party/inventory JSON, accepted body, gold20.77 and one direct first-contact fact. A phone review exposed a clipped retry and the bottom resize handle intercepting End Conversation. Compact copy, a larger error region and a footer gutter now pass inspected desktop1278x760/phone390x844 renders. In a disposable actual-autosave copy, native Retry followed by center End Conversation while Thinking preserves the resolved topic timestamp, party/inventory hashes, body, gold and direct meeting facts. A delayed controlled HTTP503 cannot reopen the closed dialog or publish a reply; two requests and zero page errors were observed. This controlled failure fixture is distinct from the actual local-model aborts. At that earlier checkpoint, no meaningful generated reply or transport cancellation was accepted.

A later instrumented actual-save replay identifies the loading stage: one Roban request used installed `adi0adi/ollama_stheno-8b_v3.1_q6k:latest`, a 1,114-character prompt and a 4,096-token context. It aborted after 90,006 ms. Matching local service times 18:43:46–18:45:17 show the runner still loading, then client-disconnect cancellation and HTTP 499; no text was returned. At 18:44:55 the loaded-model list was empty. GPU usage of 7,901/8,192 MiB was observed, but does not prove resource causality. The error/retry UI and native exit render correctly; one direct meeting fact, accepted body, gold 20.77 and inventory remain intact.

After that disposable browser closed, a same-model, same-options empty-request loading control also timed out after 240,024 ms. This is a bounded negative loading result, not NPC speech. It does not justify increasing the game timeout or silently changing models. Provider routing, model choice, inference timeout, keep-alive and user saves are unchanged. Next isolate the local runner/loading/resource failure using new evidence before another conversation attempt, then play a source-consistent exchange. Reference for the loading control: [Ollama model preloading](https://docs.ollama.com/faq#how-can-i-preload-a-model-into-ollama-to-get-faster-response-times). Ignored proof lives under `.agent/scratch/gameplay-flow/replies/`: `real-trace-receipt.json`, `real-trace-server-tail.txt`, `loading-control-receipt.json` and actual desktop/phone captures.

## Household conversation opportunities

Household projection establishes a resident's family and job; it does not establish an offer to become an adventurer. DialogueInterface now asks the shared canOfferPartyInvitation rule before displaying an invitation. The central evaluateRecruitOffer rule also rejects ordinary household recruitment through disposition or paid-hire offers. An existing companion record with the same stable NPC ID opens the existing invitation route, with its normal trust requirements. Explicit encounter-rescue consent and untagged authored/legacy opportunities retain their established behavior. This keeps future personal stories possible without guessing motives or skills from a biography.

The generic wares topic now requires a merchant role or ownership of persisted storefront stock. Empty stock remains a real sold-out shop; a dangling business link, another person's business, and simulation-only farms/mines do not create wares. Stale/direct trade selections are checked again before any session or cost mutation. This changes eligibility, not the existing stock, prices or purchase flow.

Verification: eight of fourteen new cases failed before the repair; 73 distinct cases across eight affected suites now pass, including existing recruitment consent, authored graphs and reply recovery. Nine changed source/test paths have zero scoped type errors and zero suppressed diagnostics; the existing declaration twin is retained. One ten-target header wave updated three sources, left two unchanged and skipped five tests/declarations absent from the graph; seven dependents were reported without writes.

Native actual-save play reached Roban through Continue, To Player, his source household profile and Talk. Inspected 1278x760 desktop and 390x844 phone renders retain his real merchant topic and remove the generic invitation. Party/inventory hashes, accepted body, gold20.77 and one direct meeting fact exactly match the source autosave. There were zero model requests and zero page errors; normal End Conversation worked. The initial resident-count probe preceded settlement and is not a resident census. Child/nonmerchant availability is covered by mounted UI and policy tests; a new physical child conversation was not played in this pass. No user manual save was overwritten.

GF-G21 remains open for actual story-led adult recruitment with demonstrated skills and personal quests. The trade topic's existing speech path is not proof of opening the real storefront; that integration needs a native play loop. GF-G69 local model loading and GF-G71 renderer recovery remain separate. Ignored proof: civilian-before-tests.txt, civilian-after-tests.txt, civilian-graph-tests.txt, civilian-types.txt, civilian-after-receipt.json, civilian-continuity.json and inspected images under .agent/scratch/gameplay-flow/replies/.

Later Town evidence10211 finds a legacy life-record mismatch: rendered Roban/work-plot IDs disagree with the saved canonical resident/death/home records. This UI proof does not establish that the keeper is canonically alive. Town owns the stable provenance/lifecycle repair; no resurrection, filtering or numeric-ID migration was performed here. Confirm the seller's authoritative life identity before the next real storefront conversation.

Product direction: Aralia is a desktop game. The user explicitly rejected mobile viewing-pane work. Verify future gameplay against the intended desktop game surface; phone-width captures above are historical supplementary checks, not a product requirement or acceptance criterion. Review only mobile-specific changes introduced by this agent; preserve unrelated work and desktop behavior.

## Desktop dialogue storefront handoff

Verified: 2026-10-31 source/test, read-only rendered component and native campaign adoption checks. TavernGossipSystem.chronicleRumorContext validates the local retained event ID, day and exact words before showing its subject and age. The existing townNewsContext supplies Today, Yesterday or N days ago. Paid offers show this safe context without the hidden account; unknown chronicle dates remain unverified. New note descriptions snapshot age when purchased. Existing notes are not rewritten; RumorMill can show context beside a matching legacy note while its active local source remains available.27 affected cases and5 scoped paths pass. Rendering on a read-only earned checkpoint copy and the actual reached Bryn service are inspected. Stable-cut adoption preserves28presentgroups/XYZ. Actual offers show319days of age before payment and the retained note249days; opening charges nothing and creates no speech. Final15:22:59to15:23:05fullreload preserves28groups/XYZ, originalnote/twospokenrecords and unusedbooking exactly. Newly dated receipt creation has transaction integration coverage; the second native offer was not bought.

Verified: 2026-10-31. A registered tavern proprietor's unoverridden global_rumors inquiry also uses this handoff, carrying optional initialTab:gossip through merchant execution and UI state to the existing Rumor Mill. The hook rechecks ownership, tavern type and authored overrides before recording effects. Ordinary attendance still gates opening. This selects offers only: payment, disclosure and receipts remain owned by the existing information purchase flow. No generated reply or spoken-memory record is created by opening it. Native1440x900 reached Bryn replay issues zero provider requests and preserves all28 checked state groups/XYZ after full reload;79affected checks and12 scoped paths pass. Other residents, authored overrides and non-tavern stores retain their dialogue path.

For projected household speakers, the wares topic resolves their registered WorldBusiness and hands it to the existing OPEN_DYNAMIC_MERCHANT action. A linked shop must belong to that speaker; an unlinked legacy speaker needs exactly one owned shop. Empty stock is valid. Ambiguous or wrongly owned businesses cannot be guessed. The existing action retains authority over life, attendance, stock, prices and transactions. Static authored NPCs retain their prior dialogue route.

The controller copies its topic-session input before resolution. A successful handoff records the question once, closes dialogue and opens the merchant without requesting generated speech. Missing action wiring or stale ownership produces a visible failure before recording effects; it cannot pretend to open a shop or offer a voice-only retry. Other conversation and reply-recovery routes remain intact.

Verification: fifteen new cases first produced ten failures plus one uncaught callback error. The repaired wave passes83 distinct cases across11 suites; six scoped source/test paths have zero errors and zero suppressed diagnostics. One six-path dependency-header pass updated one source, left two unchanged and reported three new tests outside the graph; four dependents were reported but not written.

Actual1440x900 desktop play used the existing Town Plan inspector for plot157, Talk to keeper, then Show me your wares. Sten Ironwell opened The Shadowed Enchantments merchant UI. Native reload, Continue Journey and the same normal interaction opened it again. Party, inventory, gold20.77, accepted body, saved stock and the single direct meeting fact stayed exact. The question timestamp persisted across reload and advanced only on the repeated question. Recorded generation requests, page errors and console errors were zero. Inspected proof and read-only autosave receipts are in ignored .agent/scratch/gameplay-flow/replies/: storefront-native-reload-receipt.json and storefront-desktop-repeat-after-reload.png; focused checks are storefront-after-tests.txt, storefront-memory-tests.txt and storefront-types.txt.

This is the legacy remote Town Plan interaction, not physical arrival inside inn157. The player remained at the previous doorway; the obstructed close camera and physical approach remain open. Sten is a living-source candidate from the Town owner, while the latest global lifecycle migration has separate owner qualification. The fitted inn still serves its preserved legacy enchanter_shop stock, the existing GF-G25 mismatch. No stock migration, purchase, sale, haggle, generated story, personal quest or recruit was accepted. GF-G21 remains open for story-led companion opportunities with actual skills and motives. Desktop is the product target; phone layouts are not an acceptance target.

A later bounded desktop speech experiment used the existing in-game model picker in the isolated gameplay copy to select the already installed phi4-mini:3.8b-q4_K_M for dialogue only. One normal Who are you question to Sten generated one local request. It also failed while loading: matching20:57:11–20:58:34 local service logs show the2368.57MiB CUDA model buffer, repeated loading/not-responding status, client cancellation and HTTP499 after1m30s. No reply text arrived and the loaded-model list remained empty. The native desktop failure/Retry/End controls rendered correctly. The previous dialogue model selection was restored through the same UI; original user storage, model defaults and provider routing were untouched.

Read-only before/after comparison keeps party, inventory, gold20.77, accepted body and all worldBusinesses exact. The entire NPC memory delta is one legitimate global_who_are_you topic timestamp; first-contact facts remain unchanged. There were zero page errors. One recorded console404 was the agent's incorrect diagnostic URL /api/ollama/api/ps, not a gameplay request; it is retained rather than counted as a clean-console run. System free RAM was661596KiB before the attempt and2565100KiB near its end; GPU use before was4170/8192MiB. These observations do not prove resource causality. No second request was issued. Ignored proof: small-model-native-receipt.json, small-model-final-storage.json, small-model-server-tail.txt and inspected small-model-native-outcome-desktop.png. Next diagnose the common local runner-loading path with fresh evidence before another speech retry; meaningful generated conversations remain unaccepted.

## First meetings and returning greetings

Direct dialogue and generated-resident Talk snapshot whether the speaker already has a direct player_met_npc fact before recording contact. The optional session contactStatus carries first-meeting or returning through the existing action/reducer contract. Roster registration, metNpcIds alone and gossip do not establish a prior direct conversation. The generated-resident route also repairs a missing direct meeting fact when a legacy roster flag already exists, without replacing a real first-contact fact.

A first direct meeting now opens with the resident turning to speak; a repeat acknowledges the earlier conversation. These are brief narrative openings, not invented NPC speech. Direct Talk no longer replays an old topic answer as a new greeting. Older sessions/callers without a snapshot preserve their existing same-speaker opening; authored graphs, newly generated openings and companion conversations keep their routes. Topic updates preserve the snapshot.

The greeting wave passes52 distinct cases across five affected suites, including both Talk boundaries, reducer, mounted reply recovery, authored graphs and storefront integration. Eight scoped source/test paths have zero errors and zero suppressed diagnostics. The first baseline exposed eight failures; two additional actual generated-resident route cases failed before that route was connected. A single five-source header pass updated two, left three unchanged and reported101 dependents without writing them.

Actual1440x900 desktop play from the retained Sana journey shows Sten157 recognizing the earlier meeting, then the first Bram121 Talk with no prior fact. Bram's first greeting remains first-meeting even though contact is recorded immediately. End/reopen and native document reload/Continue Journey/Talk both show returning. Exactly one direct Bram fact retains its ID, wording and original timestamp through those visits. Six core groups (party, inventory, gold20.77, worldBusinesses, actual playerGroundPos and quests) stay exact across the interaction; all nine measured groups, including complete NPC memory, met IDs and generated NPCs, survive reload unchanged. Requests to generate/chat, page errors and error-level console entries are zero.

This remains the existing remote Town Plan Talk route, not physical arrival at either business. It does not qualify personal quests, meaningful generated conversation, companion recruitment, shop catalog coherence or the broader town simulation. GF-G21 remains open. Ignored proof under .agent/scratch/gameplay-flow/replies/: greeting-native-receipt.json, inspected greeting-first-desktop.png, greeting-return-desktop.png, greeting-bram-return-desktop.png and greeting-reload-return-desktop.png, plus greeting-before-tests.txt, greeting-town-route-before.txt, greeting-after-tests.txt, greeting-types.txt and greeting-headers.txt. One screenshot timed out after the return greeting had rendered; observation confirmed the same page complete, and a later screenshot succeeded without repeating Talk or resetting the journey.

## Public destination, cold recall and measured meeting support

Desktop normal Talk now lets Elara name her public restoration destination.
The reducer rechecks speaker presence, public active goal, full world seed and
authored site identity. A changed catalog cannot replace directions already
shared. Listening creates one attributed memory and a discovery note, without
a player promise, quest acceptance, trust, party membership or reward. Existing
preparations, provisions, secret goals, invitation history and positions remain.

Actual Mara heard Temple of the Morning near Kytion, cell 4413, burg 93:
wf:2174083420/cell:4413/dungeon:temple-morning-v1. This is the loaded browser
catalog source. The earlier Node fixture instead selected cell 4414 near
Neapodes, with 35 total sites versus 36 in this browser. That source parity
failure is unresolved. Preserve the learned Kytion directions; do not substitute
the Node fixture or claim a reached entrance or safe route.

Mara Elara Destination Shared, timestamp 1793218583533, SHA256
776b79e91334ad2761bbb1a1df74872a35f248e9c8c87f43e7edc8e226c5c36f,
adds exactly one goal destination, one companion memory and one discovery.
Nine core groups, all other companion content and twenty historical payloads
remain exact. After native browser close and reopening the same persistent
profile, all 26 IndexedDB records deep-match without restoration. Native Load,
ordinary Elara Talk/Recall and another normal named save retain eleven groups,
all NPC known facts, one disclosure memory and twenty-one historical payloads.
The final Chronicle is aralia_rpg_slot_Mara Elara Destination Reloaded, timestamp 1793219053127,
SHA256 66d2989f35cf27077727cd91b01bd0f5f9d3d3bf430813b13d893572f017fa27. HP 12, gold 8 and party Mara only remain.
Earlier backup restoration remains distinct history; this is a new actual
cold-profile persistence proof for the public disclosure. The desktop renders
were inspected. There is no clean-console or overall graphics acceptance.

Forty-eight distinct affected cases pass: sixteen destination, eighteen shared
account and fourteen preparation cases. Eight scoped paths pass with zero
errors or suppressed diagnostics; the final two-path guard follow-up also
passes. Seven dependency headers were updated; 123 dependents were not written.
The required independent desktop client smoke reaches the title and is inspected.

Read-only actual R3F inspection now resolves the meeting-support diagnosis.
Mara remains at Y 6.166488720703125, above canonical terrain 3.8723420020916612
and below mounted civic bridge deck 8.822733879089355. Published water is
4.9817633628845215 and measured Loxodon mouth clearance 1.9764025752604337.
Initial support is false; idle walking refuses the same XYZ. Kaelen terrain
5.96834140003279 passes support; Elara terrain 4.903384924753773 does not.
All three retained anchors are below the same civic bridge, approximately
242 by 77 m. Its source is canonicalTownWaterAndDecks and townEngine carriageway
width max(fpSpan * 0.012, bridgeSpanLen * 0.32), not a regional crossing receipt.
Rendered terrain query is -2.490863489739376 at Mara: previous wording that
terrain covers her is superseded by the measured overhead deck. No actor,
terrain, bridge, water, height or game state was changed by this inspection.
Do not drop, lift or restage the cast as a shortcut.

The later source comparison and public work chapter below supersede that next
action. Physical approach, earned recruitment, skills, combat, disagreement,
consequences and independent lives remain open.
Proof and captures: ignored .agent/scratch/gameplay-flow/companion-journey/
public-destination.proof.json, public-destination-cold.proof.json,
public-destination-source.cli.txt, live-footing-measurement.json and desktop PNGs.

### Catalog source comparison

Read-only SHA comparisons narrow the current browser/Node destination mismatch.
Terrain heights, points, adjacency, river IDs, cell burgs, burg identities,
cultures, religions and military options match. Provinces, states, river and
feature records, notes, markers and zones differ. A fresh authored-site helper
against the current loaded atlas matches its cached Kytion site; a stale
enumeration cache is not demonstrated. The existing provinces generator draws
gauss inside its Array.sort comparator. Different engine sort call schedules
are a possible mechanism, not a proved first divergence. No FMG algorithm,
RNG stream or existing history was changed. Preserve the actual learned site.
Supporting diagnostics are node-browser-catalog-comparison.json and
node-browser-stage-comparison.json in the ignored companion scratch folder.

## Discussing retained information

Dynamic world-rumor topics now use the existing ordinary Rumor/Lead receipts as the player's knowledge source, matching TavernGossipSystem and companion sharing. The world's activeRumors pool is an offer pool; it no longer supplies unlearned account text to a player dialogue choice. The exact gossip offer sourceId must match a retained shareable note. Secrets keep their separate disclosure route. Current speaker relevance, location, expiration, prominence/recency ranking and the three-topic cap remain. Generic, authored and ambient conversation routes are preserved.

The choice shows Discuss this account, or its already-known named subject, with the full frozen receipt description and source attribution. It does not shorten a sentence after20 characters or replace a bought account with newer world text. Its response prompt frames the account as hearsay, asks for supporting knowledge and does not authenticate a route or eyewitness claim. Stale/direct selection is rechecked against the same receipt/speaker/session/location/expiry conditions before recording a question or applying costs. No price, purchase, inventory, discovery or second knowledge ledger is introduced.

Seven new failures become97 passing cases across nine affected suites, including storefront/reply recovery/authored graphs, companion sharing and already-heard purchase filtering. Five scoped paths have zero errors and zero suppressed diagnostics after correcting the optional topic lookup type. One three-source header pass updates one, leaves two unchanged and reports eight dependents without writing them.

Actual1440x900 desktop Sten157 dialogue exposes Sana's already-purchased undercity-growth account from Senna Ironstead, with the exact existing wording. The four core topics stay visible; unlearned/irrelevant raw-world choices no longer appear. Native document reload, Continue Journey and the same normal Talk restore the exact choice. Nine measured groups are exact across reload: party, inventory, gold20.77, worldBusinesses, actual playerGroundPos, quests, NPC memory, met IDs and generated NPCs. The entire inventory also matches the retained pre-change journey. Generate/chat requests, page errors and error-level console entries are zero.

This verifies presentation and availability of a retained story hook, not an answered question or NPC memory of a shared account. The choice was displayed, not selected: the known local model-loading failure was not retried. Mounted view callback and service tests cover selection preparation and stale rejection. Physical arrival remains unplayed because this is the existing remote Town Plan route. No new purchase, reward, discovery, route, recruit or personal quest was granted. Broader natural conversation and GF-G21 stories remain open. Ignored proof under .agent/scratch/gameplay-flow/replies/: rumor-native-receipt.json, inspected rumor-known-account-desktop.png and rumor-known-account-reloaded-desktop.png, rumor-before-tests.txt, rumor-after-tests.txt, rumor-types.txt and rumor-headers.txt.

## Explicit local CPU processing

Ollama0.32.0 read-only status showed no loaded models after the own desktop context/preview closed. A single phi4-mini:3.8b-q4_K_M CPU-only short-completion control (512 context,8 tokens,two threads,keep_alive0) returned HTTP200/text in42.675seconds, including39.627seconds loading. A later CPU control at the game's4096 context returned HTTP200/text in40.652seconds, including38.753seconds loading. The intervening normal-device4096 preload timed out after90.013seconds; service logs reached GPU offload/graph warmup before client cancellation/HTTP499. No duplicate ran while either was live. Loaded models were empty again afterward. Free RAM and GPU use varied between controls, so this does not establish GPU causality or healthy NPC speech.

The existing model picker now offers Run on Automatic or CPU only per job. Automatic remains the default and emits no device override. Explicit CPU sets num_gpu0 for that job's local generate/chat requests; it is read for each request, preserves the chosen model, and never changes an active cloud route or installs a fallback. Clearing the choice restores Automatic. CPU uses system memory and can be slower; this is an explicit resource choice while the 3D world uses graphics memory.

Nine failing cases become40 passing affected cases across six suites. Seven scoped source/test paths have zero errors and zero suppressed diagnostics. One four-source header wave updates four and reports sixteen dependents without writing them. Native setup is rendered and selected in the isolated desktop profile. Two native CPU replies returned HTTP200 but failed source-coherence qualification; neither short control was gameplay. No shared service restart, model install, global default, provider, timeout or user-save change was made. Request options and keep-alive control follow the [Ollama API](https://github.com/ollama/ollama/blob/main/docs/api.md?plain=1) and [FAQ](https://github.com/ollama/ollama/blob/main/docs/faq.mdx). Ignored proof: cpu-loading-control-receipt.json, cpu-4k-loading-control-receipt.json, gpu-preload-control-receipt.json, matching server tails and cpu-choice-* check output under .agent/scratch/gameplay-flow/replies/.

Native CPU evidence and factuality repair: the real picker selected phi4-mini/CPU only for dialogue, leaving other jobs Automatic. The first real Sten157 Who are you request used num_gpu0/context4096 and returned48 tokens in about79seconds (66.870seconds loading). It invented Heartwood Inn instead of the registered The Shadowed Enchantments. The next actual question, after supplying owned business names and the original direct meeting fact, named the correct workplace but invented childhood history and Aeliana; it returned100 tokens with done_reason length in about88.4seconds. Both raw outputs and rendered versions remain in ignored cpu-native-negative-receipt.json. All six measured core groups and the original meeting fact stayed exact; no new named person, quest or world fact was registered. These are native transport successes, not coherent conversation acceptance.

The shared prompt builder now supplies owned business names without turning a legacy shop type into a job, and serializes the existing direct first-contact fact with first-versus-return timing. Five new failing cases become75 passing affected cases/six suites; two scoped paths are0/0. Following the second factuality failure, NPC-only generation now uses0.35 temperature and a stricter supplied-facts/complete-sentences instruction. Voice profiles still guide the prompt, while generated wording is stored and shown unchanged apart from trimming: actual post-generation rewrites had changed negation and place phrases and inserted distracting tics. The standalone speech utility and authored/companion routes remain available. One new wording failure becomes49 passing affected cases/seven suites; four scoped paths are0/0. These overlap earlier suites and are not added to a cumulative total. The final four-source advisory pass updates two, leaves two unchanged and does not write fifteen dependents. The third actual desktop replay returned in about 19 seconds after an explicit CPU warm-up, with temperature 0.35 and generated wording displayed unchanged. It still invented Sana performing music and a moonlit meeting. No performance, meeting time or shared venue is recorded. This is a third factuality failure, not coherent dialogue acceptance. A separate settings-cache repair now makes a newly selected model take effect on the next request instead of reusing the old cached model; all 31 affected routing/settings/client/picker cases pass. Explicit source-backed household identity, family and contact topics now use the existing dialogue path as described below; open questions retain generation. Desktop is the acceptance target; phone checks are historical only. Cold latency, default-model loading and the complete NPC story/quest goal remain open.

A controlled source-input fixture now reproduces the complete browser Kytion site exactly in Node when given the browser occupation and marker-cell inputs. The geography and settlement inputs already match. This locates the new selector difference in its differing world-history inputs, rather than demonstrating a nondeterministic companion selector. It does not repair the older history generator or establish a route. The actual cold browser continuity proof remains separate. See selector-source-inputs.proof.json in ignored companion scratch.

## Public work offer and remembered refusal

The existing quest owner now supports Available offers, explicit acceptance,
withdrawal and inactive progress guards. Companion work choices retain Elara's
restoration ambition, previous preparations, belongings and travel consent.
An exact source-world arrival discovery can record a sighting; reporting it
requires a deliberate conversation with the present Elara. Generic checkboxes,
learned directions and rumors cannot manufacture a report or restoration.
The new companionGoalWork helper/reducer and conversation choices extend the
existing quest, journal, memory and dialogue paths. Available work is visible
in Quest Log, with the human giver and an explicit unaccepted status.

Actual desktop play asked how to help, read the offer, inspected Available work,
saved Mara Elara Work Offered, fully reloaded and recalled it. Mara then declined
without first making a promise. Elara said she would not count on a report and
that her restoration remains her own. The journal records no promise. Another
full document reload, exact named Load and normal Talk/Recall reproduced:
"You declined my offer. I am not treating it as a promise."
The final native save is Mara Elara Work Declined Reloaded, timestamp 1793225274188,
SHA256 ae1d0ce0aba4be5c5fccafdf7ee77e7493fc25ad08037bbca3dcc0d7f019593e.

Payload comparison proves exactly one offered and one declined work memory.
Recall adds neither memory nor trust. All other companion content, old quests,
nine core groups and 23 historical named/default payloads remain exact. The
declined companions, quest and journal also remain exact after reload. Mara
remains alone at HP12/gold8/items13; Elara retains her supplied 2/2 and approval2.
These are full document reloads in the persistent browser profile, not a new
browser close/reopen claim; the earlier cold-profile disclosure proof is separate.

Rendered 1440x900 play exposed a constrained 400px conversation panel. It now
uses a 640px desktop reading area and more available height; the offer choices
are visible together after scrolling to the work card. A second defect exposed
an undiscovered internal entrance subtitle in the objective. New offers and
retained incomplete-objective rendering now use the public temple name without
changing saved source identity or progress. Both fixes were replayed and visually
inspected. Desktop is the target; no mobile checks were run.

Supporting checks cover 81 distinct quest/related cases across bounded runs,
sixteen scoped paths and a four-path follow-up, all clean. The final wording
repair reruns 23 overlapping cases and three scoped paths with zero errors or
suppressed diagnostics. A two-source advisory follow-up is unchanged and leaves
four dependents unwritten. The independent desktop web-game client reaches the
title and its capture is inspected; actual story proof comes from the played
save above. Existing depth-blit warnings and title accessibility/font-CSP errors
remain; no clean-console or performance claim is made.

The separate read-only placement helper passes 34 affected cases/two scoped
paths. Actual inspection matches Mara's saved Y exactly to the old nearest-cell
sample and identifies the cast's copied height. It leaves every anchor unchanged.
The user's explicit legacy-height correction decision remains pending. No
migration, movement, corrected floor, reached entrance, scouting acceptance,
report, restoration, recruitment or companion skill/combat use is qualified.
Next inspect fresh-entry and initial companion placement so new journeys gain
real support from their own source positions, while preserving the old save.

Ignored proof: work-journey.proof.json, work-declined.cli.txt,
work-declined-reloaded.cli.txt, work-offer-wider-desktop.png,
work-declined-journal-desktop.png and work-declined-reloaded-desktop.png under
the companion scratch folder. Legacy placement review and selector-source-inputs
remain supporting read-only diagnostics, not route authority.


## Household personal questions from saved facts

Household identity, family and meeting questions now resolve explicit factual replies through the existing topic service, controller and dialogue outcome hook. This is a selected-topic path, not a fallback after generation failure. Open rumors, directions, retained accounts and authored graph routes keep their existing behavior. Explicit personal knowledge overrides retain authored or guarded behavior. Source identity and life admission are rechecked before any question or answer is recorded.

The existing household projector exposes NPC.occupation independently of role, class and shop type. FamilyMember.lifeStatus preserves tracked death, future birth and uncertainty; untracked relatives retain their previous shape. Future births are omitted from current family answers. Missing family data does not imply no family. Existing person IDs, capabilities, equipment, businesses and earned memory are preserved. Work-slot succession and person-memory migration remain separate open work.

Actual 1440x900 desktop play: Sten157 introduces himself as an innkeeper and owner of The Shadowed Enchantments, names Fenna as spouse and Fen as child, and recognizes prior direct contact. Aldric79, previously unmet, says this is the first meeting even though the direct contact fact has already been recorded; ending/reopening then gives the returning answer. These choices make zero model requests. Six core groups are exact: party, inventory, gold20.77, businesses, actual playerGroundPos and quests. All67 saved NPCs retain their non-projection fields after excluding only occupation, family life status and the projection signature. Sten's original direct meeting fact is exact. Final-source native document reload/Continue/Talk preserves the returning answer and exactly one original Aldric meeting fact, including timestamp. Eight measured groups reload exactly, including all NPC memory and met IDs. Complete generated NPC JSON intentionally differs only by removing60 temporary untracked life-status properties and refreshing22 corresponding projection signatures; all other fields are exact. This is remote Town Plan Talk, not physical arrival.

Verification: 47 affected conversation cases/eight suites pass before the final additional lifecycle cases. The final projection/controller wave passes44 cases/six suites; final personal wording/controller passes17 cases/two suites. These overlap and must not be added as a total. Ten scoped paths are0/0, with the final three touched paths rechecked0/0. A legacy exact-family assertion failed when untracked life status was added; omitting that unnecessary field repairs the same check. One six-source header pass updates three, leaves three unchanged and reports42 unwritten dependents. The separate desktop web-game client completes an inspected menu smoke. Proof lives under ignored replies scratch, including personal-identity-desktop.png, personal-family-desktop.png and personal-first-contact-desktop.png. This establishes reliable factual personal questions, not complete NPC stories, quests, life simulation or coherent open generated dialogue.

Actual Aldric family play also exposes an existing source issue: two children both named Cob Hartton, ages8 and15, with unresolved life identities. The reply preserves both and expresses uncertainty. They were not renamed, merged, declared deceased or assigned invented histories. Resolve source identity/lifecycle in the Town strand before claiming a coherent complete household. Ignored personal-native-receipt.json and personal-final-storage.json preserve the played checkpoint. There are zero page errors or error-level console entries. The union of the affected conversation/projection checks is74 distinct cases across11 suites; final wording/controller17 reuses part of that union.


## Work conversation follows an actual trading day

The household personal-answer path now offers How is work going? when the living resident owns an unambiguous NPC business with a fresh, consistent daily report. A valid linked business wins; multiple unlinked businesses are not guessed. The existing speaker/life/knowledge-override guards still run, and the outcome hook rechecks the answer before recording it. Mismatched legacy inn/enchanter or shop/tavern records remain untouched and cannot become a false work story (GF-G25).

The answer describes the saved business and whether its latest takings cover costs. Supply, competition and staffing concerns appear only when the daily report records them; low seeded metrics alone do not imply an event. Newly registered all-zero, stale, future, malformed or financially inconsistent reports cannot establish current work conditions. No private goal, culprit, debt, quest, reward or hardship is invented. This conversation records the question and last answer through the normal path without altering the business, inventory, gold or quest log. It does not preserve a full financial conversation history.

Actual1440x900 desktop Sana Town Plan123/Talk/How is work going? reaches Fenna Hartham. She names The Shadowed Provisions and says the latest takings did not cover costs, matching the saved day3 report: revenue11.56, costs12, profit-0.44 and no supply/staff/competition issues. Seven groups remain exact: party, inventory, gold20.77, businesses, actual playerGroundPos, quests and all67 generated NPCs. One direct first meeting and the work question are recorded. Model requests, page errors and error-level console entries are zero. This remains remote Town Plan Talk, not the Town strand's separate physical Fenna arrival. Full native document reload/Continue/Talk reproduces the answer, with all nine measured groups exact before the repeated question, including NPC memory, met IDs and all67 generated NPCs. The original Fenna meeting is not duplicated.

Seven work assertions fail before implementation. An initial partial fixture omitted NPC ownership; correcting that fixture retained the strict owner guard. Final57 affected cases/six suites pass, including authored graphs, reply recovery, trade, family and work controller routes. Three scoped source/test paths have zero errors and suppressed diagnostics. A one-source header pass is unchanged and leaves five dependents unwritten. The separate desktop web-game client completes an inspected menu smoke; actual dialogue evidence is work-fenna-desktop.png under ignored replies scratch. Full generated coherence, household identities, NPC personal stories and quests remain open.


The same actual journey then used normal Long Rest / Wait18 hours (no rest confirmation) from day3 17:44:14 to day4 11:44:14. The wait is allowed even though this occupied property does not permit making camp; it grants no rest benefits or provision consumption. Daily simulation updates Fenna's actual report to revenue14.8, costs12, profit2.8, with no listed problems. Normal Town Plan/Talk/How is work going? now says takings covered costs with something left over. This is a real source-driven change across a trading day, not a seeded positive test or model instruction. Party, inventory, gold, actual body and quests stay exact across the wait; the one original direct Fenna fact stays byte-exact. Business and town simulation changes are expected world progress. The positive day also survives full document reload, Continue Journey and the same work question. All nine measured groups are exact before the repeated question. The one original Fenna meeting fact is exact through both days and reloads. The earned day 4 continuation is work-final-storage.json; work-native-receipt.json records both reports and both nine-group comparisons. Inspected work-next-day-desktop.png and work-next-day-reload-desktop.png show the changed answer.

## Continuous entry height and obstructed fresh meeting

World3DWrapper now uses the existing continuous groundSurfaceYM query in its
three initialization paths. Each newly placed cast member samples their own
X/Z before first render and checkpoint. Existing finite companion positions
are never resampled. Numeric-height callers retain their prior contract.
Fourteen focused cases pass, including a fractional Atlas focus on sloped
terrain and a retained anchor whose sampler must never run. The first fixture
attempt changed its focus without its matching source marker; that mismatch
was corrected. Four scoped paths have zero errors or suppressed diagnostics.
One header pass updates Wrapper, leaves companionWhereabouts unchanged and
reports four dependents without writing them. The independent desktop client
title capture is inspected; it is not the actual placement proof.

Actual play used a separate persistent profile: normal Begin Legend, Auto-Fill
and Begin in Phu created Caelia Crane, a Human Monk, in world 1793225896251,
cell 2603. The configured qwen3.5 opening model is not installed; normal
Continue to World was used. No generated opening or provider change is claimed.
Native browser resizing settled at 1440 by 900 for rendered inspection.
Caelia's Y is 8.257288094689828, Kaelen's 8.234386303012235 and Elara's
8.215817759476367. All three pass the current center-support check. This is
actual per-person height evidence, not full-body clearance or a safe arrival.

To Player reveals the figures intersecting a building wall. W for 700 ms and
S for 1200 ms after full reload leave exact XYZ; neither is a successful walk.
The first native Talk names Elara's cleric role and public restoration goal.
Save, full document reload, exact named Load, revisit and resave preserve one
direct meeting fact with its complete ID/timestamp and ten measured groups,
including companions, resources, old quests, met IDs and discoveries. Latest:
Caelia Meeting Reloaded, timestamp 1793226588664,
SHA256 e791e49ccfa14a4a98f3f5a4f6a972c389bbe7e2aa18fe3b12c2743df2f87faa.
These interactions do not qualify discovery through exploration or a playable
companion approach. The figures' solid/body placement remains deficient.

A separate native Mara Load on the new source preserves her exact saved feet
and both retained companion anchors. All 26 historical default/named payloads
remain byte-exact. The old support warning remains. No legacy correction or
migration was applied, and the explicit decision remains pending.

Source inspection also finds useGameInitialization unconditionally registering
all authored companions at every new player's start through PLACE_SITUATION_NPCS.
That older findability scaffold explains presence; it does not establish an
independent reason, life, workplace or journey. Extend source-bound placement
without deleting its intended meetability or restaging existing people. Do not
invent an excuse in dialogue for unsupported world connections.

Next repair new public-space entry from existing canonical streets/plazas with
body, solid, water and grade checks, then replay the affected fresh-start
sequence. Preserve Caelia's and Mara's accepted anchors and original Chronicles.
Independent companion whereabouts, earned travel, meaningful skills, combat,
restoration, disagreement and reunion remain open. Proof and inspected captures
are ignored under .agent/scratch/gameplay-flow/companion-journey/:
continuous-entry.proof.json, caelia-ground-desktop.cli.txt,
caelia-first-meeting.cli.txt, caelia-meeting-reloaded.cli.txt,
mara-source-anchors-preserved.cli.txt and matching desktop PNGs.


## Remembering a work conversation

A delivered factual work reply now enters the speaker's existing NPC interaction history. The normal last-response action publishes the visible line and its history together. The record keeps the exact words, conversation date, work topic and the trading report used for that statement. This is an attributed conversation record, not a new world fact or a separate accounts ledger. Existing display-only and generated callers retain their previous behavior.

Publication checks the active conversation, current owned report and speaker provenance. The key includes the full world seed, NPC identity, household member and the saved life person's ID and birth day. It uses the persistent life record rather than the current visual-roster number. Ambiguous or missing life provenance cannot create this record. A projected keeper name that disagrees with the saved life person is also withheld; that mismatch does not authorize reusing the older conversation. Repeating identical wording from the same report preserves the original record and date; reading recall creates no additional interaction. Existing contact facts, disposition, suspicion, goals and all other NPC memories remain unchanged. A replacement life record or another world cannot borrow the prior conversation. Full person/work-slot migration remains open.

What did you tell me about work? appears only after a delivered work reply has been recorded. It quotes the saved words without rebuilding yesterday's speech from today's accounts. Old saves with only global last-response text gain no invented history. Recall uses the original conversation date for yesterday wording, independently of the report date. Existing memory migration already preserves optional interaction metadata, so no bulk save rewrite is needed.

Actual 1440x900 Sana/Fenna Town Plan play begins with zero interaction records and no recall choice despite the older saved display line. Normal How is work going? records one day-4 statement using revenue 14.8, costs 12 and profit 2.8. Recall quotes that delivered line and keeps one record. Normal Wait 24 hours reaches day 5, whose new accounts are revenue 12.95, costs 12 and profit 0.95. Recall before asking about current work retains the original day-4 record byte for byte. This remains remote Town Plan interaction, not physical arrival. Zero generation requests or page errors are observed. The first measured full document reload preserves all nine groups and shows Yesterday based on the original conversation date. A day-5 work reply then creates a second persisted record with the new source, preserving the original day-4 record. A second measured reload preserves all nine groups and both statements. Final-source repeat delivery and recall keep both statement records byte-exact, without a third interaction.

Seven of eleven initial memory assertions fail before implementation. The first complete wave passes 91 affected cases across seven suites with nine scoped paths clean. A new stale-concern assertion then fails: financial figures alone did not detect a changed delivery report. Publication now snapshots and checks supply, staff and competition entries too. Final 93 affected cases pass, with all nine scoped paths at zero errors and suppressed diagnostics. A six-source advisory pass updates four headers, leaves two unchanged and does not write 103 dependents. The 19-case dated-wording/controller subset and two scoped paths also pass; these overlap the full wave. A later projected-name/person mismatch assertion fails and is repaired by withholding attribution until those names agree. The final 22-case memory/controller subset and two scoped paths pass. The union is 94 distinct affected cases across seven suites; subsets overlap and are not summed. All three measured document reload comparisons keep nine groups exact. Repeating the day-5 work reply and recall preserves both records with their original dates. Full conversation history, generated coherence, personal quests and independent NPC life arcs remain open.

## Clear public entry in the affected Phu world

World3DWrapper now checks a new unsaved cell-native town entry through
initialTownEntry. It measures the existing player/cast recipes with the same
body assembly, disposes the temporary handles, and searches actual town-street
centerlines and plaza interiors within 80 m. Every member's standing footprint
must fit public space, remain dry, satisfy grade limits and avoid building plots,
walls and decks. The bounded search refuses when no fit is found. It neither
changes geometry nor infers a bridge surface, travel consent or quest progress.
Matching saved entries bypass the search; Atlas's explicit retained focus keeps
its own handoff. The existing cast layout and durable NPC checkpoint owner remain.

Actual desktop play in Phu's full seed 1793225896251, cell 2603 and burg 4 chose street 335
at 465.262294/478.430038/Y8.212731 before first position commit. Cederic walked
forward/back, met Elara, saved and fully reloaded. Eleven groups and every NPC
known fact remain exact, including the direct meeting's ID/timestamp. A separate
new traveler/profile supplied this replay; old Caelia and Mara anchors and
historical named saves remain exact under native Loads. Twenty-four focused
cases and three scoped paths pass. See the matching TRACKER section and ignored
public-town-entry.proof.json for hashes, measured models and played evidence.

This repairs bounded new-entry physical placement. It does not qualify the
unconditional authored companions-at-player-start scaffold as an independent
life or a normal exploration discovery. Source-bound presence and leads are next;
skills, earned travel, restoration, disagreement and persistent reunion stay open.

Final ignored proof is recall-native-receipt.json and recall-final-storage.json (earned day 5). Inspected recall-first-desktop.png, recall-yesterday-reload-desktop.png and recall-final-repeat-desktop.png show the actual dialogue. Party, inventory, gold20.77, actual playerGroundPos and quests remain exact from the original day-4 continuation through waiting, conversations and reloads. The original single direct Fenna meeting fact remains exact. Generation requests, page errors and error-level console entries are zero. Eight final source/test fingerprints match; no independent financial ledger, full dialogue-history system, new quest, recruitment or complete NPC life arc is accepted.


## Dated public household news

The existing Notice Board now dates each item as Today, Yesterday or a number of days ago. Its civic response panel shows the same source context. The shared townNewsContext projection resolves participants only from that event's subjectId and relatedIds against the saved town life records. It does not infer participants from prose, current spouses or a shared address. Missing, duplicate or mismatched records remain anonymous. Historical participation establishes neither current whereabouts nor a request for help. The existing news ordering, two-year window, civic transactions and Travel's accepted-ground town checks remain unchanged. The crier now uses the same townNewsContext age labels. Each new report stores its full world seed, burg ID and unchanged event ID/day/kind/summary in GameMessage.metadata.townCrier. This existing saved log remembers a source report across ticks, town changes and reloads. Unscoped old prose is retained without inferred provenance; the next actual hearing receives an explicit source age. Authored standing business remains available once per world, town and game day. A temporary pending-dispatch buffer resets when the message history changes, so loading an older save does not import later knowledge. Explicitly removing source-bearing log entries removes this announcement memory; no separate NPC or chronicle mutation occurs. Overheard gossip now also dates the original event through townNewsContext. Existing metadata.townGossip retains world/town/event ID/day/kind/summary and heardAtGameMs. The original 75-second interval, six-game-hour repeat policy and 24-report picker window remain unchanged. Each check derives its cooldown from the newest valid saved hearing; future, expired or differently scoped records do not suppress the present town. A pending buffer resets with a restored message history. Older unscoped prose stays intact without inferred provenance. frameOverheardGossip accepts an optional age label while preserving its original one-argument output. NPC memories, current whereabouts and chronicle records are not created or rewritten by hearing these reports.

Actual 1440x900 Sana play opens the board normally from the earned day-5 checkpoint. Event260 happened on day-51: Oswin Oakcroft and Faelan Ironfield brought home64 back into use. The panel and list now show 56 days ago and both recorded participants. Their marriage appears at the same age; the earlier abandonment is visibly 94 days old. A full document reload and native Continue preserve all nine compared groups: world seed, party, inventory, gold, NPC memory, generated NPCs, businesses, town simulation and ground position. Closing and reopening the board preserves the same context and those groups. No civic response was selected; no quest, reward, relationship or actor position was created. Generation requests, page errors and error-level console entries are zero.

Twenty-five affected cases across three suites pass, with four scoped source/test paths at zero diagnostics. The advisory pass updates townNews and leaves NoticeBoard unchanged; nine dependent headers are reported but not written. The separate desktop web-game client exits successfully and its menu screenshot is inspected; the native board screenshot is the gameplay proof. An initial close locator used visible glyph text instead of the existing accessible Close label, timed out without a click, and was corrected on the same page.

The actual saved spouses have no generated encounter actors in this checkpoint. Reaching a believable household encounter, resolving founding-household versus live-family continuity and replacing generic civic responses with relevant story actions remain open under GF-G06 and GF-G21. Ignored proof is board-context-native-receipt.json, board-context-final-storage.json and inspected board-context-desktop.png under .agent/scratch/gameplay-flow/replies/.


## Talking about a changed family

The explicit household_family answer first resolves the speaker through the existing saved-person bridge: an exact stable household key, or a unique legacy name at the same canonical home. The projected name must also agree with that life person. It reads reciprocal spouse, parent and child links from the saved town genealogy. Same-home membership and similar names do not establish kinship. Missing, conflicting or future people cannot supply a current relationship. Deceased relatives remain named without invented circumstances. A living child's reciprocal living spouse and different recorded home can be acknowledged; a home is not their present physical location. Guarded/authored topic overrides keep their existing behavior. When speaker provenance is absent, the original household answer remains available. An admitted but incomplete family record does not establish having no relatives.

This changes factual speech, not the saved family. Founding household biographies, portraits, ages, roster/body positions, actor IDs, occupations, businesses, NPC histories and town genealogy are not rewritten. The inspector now uses the shared current family for admitted people. Unadmitted household occupancy and generated open conversation still need separate reconciliation. In particular, the current canonical home64 brief names Mara/Bryn/Cob Marshwick and roster162 Mara, while the saved event260 participants285 Oswin Oakcroft and484 Faelan Ironfield live at64 without household keys. Exact source tracing confirms they cannot be relabeled as that founding household. No actor or alias was created from this discrepancy.

Actual1440x900 Sana play uses the earned day5 checkpoint. Normal Town Plan building123/Talk/Family has Fenna Hartham acknowledge Ysolde as spouse, Tib and Lark as children, Lark's marriage to Robin Marshdown and their home elsewhere in town. Saved person81's child84 has reciprocal parent links, spouse13 has reciprocal marriage links, and both have home14. The answer survives a full document reload/native Continue; normal re-open/Talk/Family repeats it. All nine compared groups are exact across reload. Before versus after the first conversation, eight groups are exact; the sole NPC-memory changes are normal lastInteractionTimestamp and the household_family discussed-topic timestamp. Every NPC known fact and interaction remains exact, including Fenna's original meeting and both recorded work statements. Generated NPC biographies and complete town history also stay exact. Zero model requests, page errors or error-level console entries are observed. This remains the remote Town Plan route, not physical arrival or a new personal quest.

Four initial current-family assertions fail, with35 passing. Implementation passes113 affected cases across six suites. Four added serialization/parent/identity cases pass in the final43-case personal subset, giving117 distinct cases across those six suites; overlapping reruns are not added. Two scoped paths have zero errors or suppressed diagnostics. Two optional-spouse fixture type errors were repaired before that final result. One source advisory header is refreshed; five dependent headers are reported and not written. The separate required desktop client exits0 and its menu capture is inspected; family-current-desktop.png and family-reload-desktop.png are the inspected gameplay proof. Reload clears the transient conversation as designed, so the answer was verified again through normal Town Plan/Talk rather than forcing its modal open. Proof, source trace and earned family-final-storage.json remain under ignored .agent/scratch/gameplay-flow/replies/.

GF-G06/GF-G21 remain open for the founding-versus-living family projection, source-bound physical encounters and full personal stories/quests. The current spoken statement does not qualify a new encounter, recruitment, character appearance or generative family coherence.

## Independent public companion activities

New-world creation uses companionWorldActivitySource.ts to connect the existing
bridge atlas and public authored restoration site to companionWorldActivities.ts.
The lightweight planner receives no player/start position. Elara prepares in the
site's existing nearby town. Kaelen seeks work on his own terms in a deterministic
real town; this authors no employer or private disclosure. Companion.publicActivity
keeps the purpose/source independently of current whereabouts. The reducer admits
only unobserved, unmet, nonparty people in the same full world seed. Existing saved
lives are not migrated. Generated opening NPCs cannot replace or summon them.

initialTownEntry resolves the first body point from the source town/square with the
existing measured-model public-space checks. It retains old points exactly and
never falls back to the player when a fit fails. placeCompanionCast projects that
fixed point into the current scene. New player arrival avoids occupied bodies.
The Wrapper and both action-handler dialogue routes require nearby finite feet
before talk, memory or recruitment effects. Existing legacy and joined-party routes
remain. TavernGossipSystem offers local unmet public activities through ordinary
paid Service receipts; that path is fixture-tested and not yet actually purchased.

Desktop Bram/Sedanes play approaches35.434m→2.196m using normal street clicks,
observes the distant-contact notice, then hears Elara's role/purpose/public temple
intention. Normal save/full document reload/exact Load/revisit/resave retain23
groups, all NPC known facts and one direct meeting fact. Kaelen remains remote.
Old Mara native Load preserves companions/feet and26 historical payloads. The
matching TRACKER section supplies save hashes and proof.78 distinct cases and14
scoped paths pass. Source activity is not a daily schedule or a complete personal
life. Close camera obstruction, recruitment, actual companion skill/combat use,
restoration, disagreement, consequences and reunion remain open.

A later native To Player check at the saved Sedanes square renders both full actors clearly at radius6 with exact reached feet. The reproduced obstruction belongs to Bram's initial arrival street, not the nearby meeting. activity-near-camera-desktop.png and its receipt are inspected. No camera implementation or actor position was changed.


## One current family view across inspection and dialogue

householdFamilyAt in householdNpc.ts owns the read-only saved-person and reciprocal-family view formerly private to dialogueService. Speech, the building inspector and the physical Meet card consume the same people and relationships. ResidentProfile renders the reached resident’s current age and reciprocal family instead of the founding summary; the Wrapper retains the existing physical reach, alive-person and Talk checks. Unknown children, servants and lodgers remain visible, and a missing or invalid clock retains the original household view. A valid game clock is required for current ages. householdNpcDescription supplies the conversation sidebar for an admitted person; authored graphs, missing provenance and invalid clocks retain the original description. Ages follow the existing fixed game-year constant and stop advancing at death. Stored biographies, traits, skills and memory remain unchanged.

The inspector shows recorded relatives and their known household occupations, including a living child's reciprocal marriage and different home. Its current family view replaces the unsupported census summary. A bounded town life roster does not cover every named household member: unmatched children, staff and lodgers remain visible under Other household records with their existing data. Two same-name people are not merged. This preserves future identity work and does not claim that an untracked person disappeared. Unadmitted households retain their original display.

These are information views. They do not change floor-plan occupancy, body placement, jobs, keeper availability, owned goods, guest-bed rules or the incompatible home64 household. Actual current-family inspection, normal conversation, shelf examination and reload evidence live in [the gameplay tracker](../../projects/gameplay-flow/TRACKER.md#family-inspection-and-conversation-share-the-saved-person). The actual desktop family view and biography data are verified separately: the displayed age is current, while the original stored biography is preserved.

Full present-day occupancy, three-dimensional appearance, generated biography coherence, physical approaches and household-led quests remain open. A remote town-plan interaction is not physical arrival.

## Arrival-street framing diagnosis

Bram walked13 ordinary street clicks back to the initial Sedanes street and saved
Bram Arrival Street Camera (1793233505612). Native To Player reproduces a one-meter
arm and visibly poor framing among posts. The saved nearby Elara square separately
renders both full actors clearly at radius6. Actual mounted-scene queries find no
clear radius4/6 arm across32 headings, or with earlier higher eye4/6/8 candidates.
Nine building AABBs overlap the real body bounds. This is broad-phase evidence,
not proof that the visible body penetrates a solid. Trace actual mesh parts and
transforms against new-entry body clearance before changing the camera. No camera
code, visibility rule, geometry or accepted position was changed in this diagnosis.
Both earlier named Bram payloads remain exact. Nineteen additional existing rumor,
receipt and lead-quest tests pass,97 distinct focused cases across nine suites in
total. The new public activity offer remains unpurchased in actual gameplay.
Ignored diagnosis receipts/captures share the companion-journey scratch folder.

## Visible building parts in public arrival checks

A plot quad does not contain every visible construction part. initialTownEntry
now rejects a proposed first standing body that overlaps rendered SitePart bounds,
including porch, facade, ensemble and motif dressing. It reuses sitePartTransform
for yaw/street-face coordinates and isSitePartRenderable for tactical exclusions.
The measured body square and rotated part rectangle use both sets of separating
axes, with source floor datum and vertical overlap. Local part bounds are cached
per immutable source building; current ground height is sampled at admission.
Directional beam bounds stay conservative by the SitePart contract. This does
not add movement collision, change geometry/camera rules or migrate saved actors.

Actual Sedanes diagnosis finds34 rendered triangles entering Bram's measured
body bounds despite old plot-only admission. Updated admission rejects that point.
Normal4.395m walking reaches the proposed public street; zero contacts and a
six-meter full-body camera are inspected. Save/full reload retains23 groups,
all NPC facts, companions and three prior named payloads. A separate fresh Kethra
Monk in the same world starts clear on street25, retaining Elara's independent
point. Her full reload also preserves23 groups.21 affected cases/two scoped paths
pass. The matching TRACKER section supplies source/body/save/hash evidence and
limits. Initial clearance is repaired; independent lives and the full companion
story are not complete. Continue agreed shared work from Bram's latest clear save.

## Bram scouting promise and desktop paving qualification

Actual desktop play at2560x1249 resumes Bram's unchanged Sedanes feet, walks
normally through the streets to Elara, asks how to help and explicitly promises
a firsthand temple account. Elara recognizes the prior meeting, explains her own
restoration and remembers the unresolved promise. The Active quest has both
objectives open. Approval stays0/stranger, party Bram alone,9HP/17GP/eight items.
This is an agreed obligation, not recruitment or travel consent. Native Save/full
document reload/explicit Load/return conversation/recall and rendered Quest Log
preserve23 complete state groups. All five older named Bram payloads remain exact.
Checkpoint: Bram Elara Scouting Promise,1793240056923,SHA256
12dc301194bdacb151d4eadf4e5a11ba63ec3a4b61c7037c562fdfa786ee7521.

The same desktop replay exposes feet hidden by road drawing layers. Actual
mounted rays put terrain within4mm of Bram's canonical feet but nine road hits
36-44cm above them. The existing private canonical-ground candidate fails with
Road footing detail exceeds bounded mesh budget. Captured chunk3,3 reproduces the
failure with17595 source vertices/5865 faces. roadGeometry now shares vertices
only when all rendered Float32 position/color/normal/road/lift attributes match;
it retains every source face and distinct layer. The unchanged250000 cap admits
237200 vertices/418725 faces with the actual captured ground heights.31 affected
road cases (one new) and two scoped type paths pass,0 errors/0 suppressed. The
single advisory pass leaves the current header unchanged and three consumers
unwritten. Other source work and LF endings are preserved.

The owned3017 server uses verification-no-watch. A second browser failure served
stale code, so it does not count as a repaired-source failure. Only that owned
server was refreshed; served sharedVertices was then positively verified. Actual
same-save/private-query replay shows both full actors clear with identical feet;
highest road hit at Bram is4.35mm above his feet instead of438.81mm. Normal named
Save/full document reload/explicit Load/recall/resave preserves23 groups and all
NPC known facts; 7 earlier named payloads remain exact. Candidate final:
Bram Scouting Surface Reloaded,1793241909975,SHA256
4bffcbf57fd5b5d0bfef9debafb48a1759f3429d79349fa531b387ad7987d00d.

This remains private groundDetail=canonical qualification. Native default is
unchanged and still deficient. Visible paving speckles/seams, performance,
movement across neighboring detail anchors and safe native adoption remain open;
no visual/performance blanket pass is claimed. No actor lift, source terrain or
water rewrite, body migration, raised mesh limit or forced encounter occurred.
Next repair the remaining paving presentation/admission, then actually find the
source temple entrance and return the promised report. Earn travel terms through
useful work; recruitment, companion skills/combat, restoration choices, independent
relationships, consequences and separation/reunion still require actual play.
Ignored proof: companion-journey/bram-scouting-save.proof.json,
bram-road-candidate.proof.json and their source captures/CLI/storage/render files.


## Saved institutional roles in household encounters

The town life registry already stores current institution roles separately from a founding household's occupation. householdInstitutionRole in householdNpc.ts projects a recognized current role only from the same admitted living person used by householdFamilyAt. Current offices are lord, priest, innkeeper, tavernkeeper, marketmaster and harbormaster. Internal wildcard tags, unknown values, future births and deceased holders do not supply a current title. The household, biography, work assignment, actor, chronicle and capabilities are unchanged.

A personal introduction in dialogueService now says that the admitted person serves in that town role, while retaining their household work and owned businesses. Authored/guarded identity responses keep their existing path. ResidentProfile, the current household inspector and householdNpcDescription show the same role. A family view may therefore show a spouse holding an institution without assigning the office to the household head. A title grants no spells, services, directions, quest, recruitment or new contact memory.

Actual desktop play through Town shops and services identifies Menaikon house 55 (source plot 54): saved Faelan Ironsmith 141 is Sten's spouse, age 86, keeps the household and holds the priest role. The source is the unchanged life record, not the 377-day-old report or a same-name merchant. Both native full reloads retain all nine PRESENT protected groups exactly. The first retains all 899 pre-reload messages and the second all 900; both retain the complete 892-message incoming earned prefix. Both actual desktop role renders are inspected, with zero page errors. The actual main temple 169 (plot 168) has a nave, altar, benches, vestry chest and private beds but no current household/contact or temple-service action. Shrine 50 (plot 49) instead names retired shrine-keeper Edith Ashdown and her household. These are distinct sources. No physical priest meeting, current temple attendance, magic service, family help or quest is accepted from this map inspection.

The affected person-view suites pass 66 cases, including 14 added regressions; four neighboring identity/civilian/memory suites pass 33 more, for 99 distinct cases. Seven scoped paths have zero errors and zero suppressed diagnostics; the detached-session test recheck is also clean. The initial role assertions expose nine failures. A first post-change test fixture shared activeDialogueSession with its mutable conversation session; detaching that session repairs the state-preservation assertion without changing production topic tracking. One scoped header wave updates householdNpc, leaves three headers unchanged and reports thirteen dependents without writing them. The desktop web-game menu smoke is separately inspected and does not prove a priest encounter. Physical attendance, a useful institutional service and a personal story remain open.

## Render precision during independent companion movement

Near-foot paving uses a shared finite projected surface so overlapping source
faces do not approximate the same ground differently. A plural render API keeps
all visible faces in bounded draw meshes; the original single-mesh refusal
contract remains available. Scene-owned sceneFootingFocus includes accepted
player feet and finite explicit nearby cast positions in one quantized patch.
The outer radius stays 16 m, inner coverage ranges from 8 to 14 m, and a 2 m
body margin keeps the player covered. People who cannot fit keep their real
positions. No layout fallback, camera destination, physical height or source
terrain is substituted. This private policy fixes the actual independent Elara
13.42 m away: road clearance falls from 350.77 to 9.51 mm at identical feet.
Actual full desktop replay and a normal named full reload retain the scouting
obligation, whole companion records and all 23 checked state groups.
This remains a private canonical-ground qualification; native default and
performance are not accepted. Physical whereabouts, obligations and consent keep
their existing owners. The native HUD World Map control reuses the real map
modal; opening/closing it preserves the 3D location and legacy scale callers.

Learned public destinations are stored separately from discovered entrances.
learnedCompanionDestinations projects only previously shared public records for
met people, checking full world, source, site, cell and goal provenance against
the current catalog. It works away from conversation and retains knowledge after
goal completion. Secrets and stale bindings do not become map cues or rewrite
memory. MapPane's desktop Learned directions row supplies a view-only cell focus
to the existing Atlas. That path never invokes the travel/discovery pick handler.
Only a later ordinary map choice can commit a journey. Actual arrival discovery
can advance the entrance objective while Elara is absent, without telling her
the news. Her received report still requires an actual deliberate conversation.
The nearby entrance prompt names only an exact full-world firsthand discovery;
learned directions alone retain the generic entrance heading.
Actual walking, save/reload, bounded road tests, rendered navigation and their
limits are in [the gameplay tracker](../../projects/gameplay-flow/TRACKER.md#paving-across-departure-and-the-return-to-the-atlas).

## Desktop conversation and received scouting reports

ConversationPanel uses a wide lower desktop frame. Speech and status remain in
the transcript column; the existing preparation, rumor, destination and work
choices occupy their own scrollable column. Both retain the same dispatch,
turn/intent locks and provider behavior. Suggested replies, buff decisions and
the composer keep their existing owners. A conversation with no authored
choices uses one transcript column. The layout preserves speaker visibility
above the surface and uses16px dialogue text. Actual2560x1249 recall is rendered
at1440x600 without horizontal overflow;13 existing behavior cases and one scoped
type path pass. This is desktop qualification, not phone layout work.

A source-bound entrance discovery does not tell the absent companion the news.
Actual near-body conversation can deliver its recorded account. The work reducer
then completes only the bounded firsthand quest, awards10 approval once and saves
a reported memory with the original discovery ID. The restoration goal stays
active. A full reload and deliberate recall retain that memory, exact original
meeting fact and unchanged approval. Actual costs, exhaustion, source whereabouts
and28-group proof are in [the gameplay tracker](../../projects/gameplay-flow/TRACKER.md#a-kept-report-remembered-in-desktop-conversation).
Meaningful invitation/consent, shared skills, restoration, disagreement and reunion
after separation remain unfinished; completion of this report is not the arc.

## Explicit shared-purpose travel offers

CompanionTravelChoices adds deliberate choices to the existing desktop
conversation. companionTravelReducer rechecks session turn, presence and source
contact. Ordinary invitations reuse evaluateRecruitOffer's friendship rule.
Elara's source-bound temple purpose has an additive opportunity after her real
received report and fulfilled road-provision promise. It stores offered terms
separately from membership. Explicit acceptance revalidates that evidence and
passes the existing authored promotion payload to companionReducer's shared
RECRUIT_COMPANION owner. No autoAccept flag, friendship increment or new party
store is used. Decline, refusal and accepted purpose remain in memory. The
optional travelAgreement retains source, destination, terms and response.

Actual desktop play now proves unrestricted refusal, separate offered terms and
explicit accepted membership without an approval increase. Her identity, goals,
relationships, personal belongings and public activity persist. Normal full reload
preserves27 of28 checked groups and16 older named payloads exactly. The exception
is the local dynamic NPC list: recruitment left her id there, while Load removes
joined ids. Recruitment now normalizes that list at join time; new gameplay
reload proof is pending. The historical mismatch remains recorded.

The joined body disappeared because the static cast correctly excludes party
members and the scene had no replacement actor. The current source mounts party
actors from retained finite feet in the same world/cell, preserving observed
appearance and using PlayerAvatar's existing gait, footing, collision and water
solver with camera tracking disabled. Pending ordered footsteps come from the
leader's actual reached feet; route targets and camera positions do not place a
person. Actual native2560x1249 replay now renders Elara at her exact original
436.81542248942407/488.6117358589292/Y26.180229255624127. An ordinary D-key walk
moves Bram2.243m and Elara2.236m through her own stride; approval stays15 and the
original departure is retained separately. Bram Elara First Shared Footsteps
saves this actual outcome at1793259652619. Normal full document reload and explicit
Load preserve28 checked groups, including both feet, nine pending footsteps,
original departure and person memory;17 earlier named payloads remain byte-exact.
The native near capture is inspected. The earlier Agreed27/28 mismatch remains
historical evidence, not rewritten as exact proof.

Reopening the original profile at the base URL also reproduces the known default
paving problem: actual road rays sit0.593m above Bram and0.432m above Elara after
walking. Their feet match canonical ground. This is a real default-render failure,
not evidence to lift bodies. Earlier precise paving proof used the private
groundDetail=canonical mode, which remains opt-in. The same saved walk is the
comparison checkpoint: private canonical gaps are9.76mm for Bram and9.75mm for
Elara, with both full bodies rendered at2560x1249. Default visuals/performance
remain unaccepted. Cross-cell arrival, overflow continuity, shared skills,
disagreement, consequences and complete story remain unproved.

The appearance recipe is memoized by its serialized observed value, so physical
checkpoint selector updates do not rebuild an unchanged body. A fresh mounted
function check and actual second eight-second D walk retain the same body UUID
across reached-position updates; the native full-body capture is inspected. This
qualifies body reuse, not an FPS claim. The affected actor wave has60 passing cases
across five focused suites. Latest Steady Shared Walk1793260792608 is normally
saved separately from the earlier28-group full-reload checkpoint.

## Shared route departure and physical arrival candidate

MapPane carries TravelRouteLineage from the reviewed planner, including the real
source, intended destination and route cells. A supply halt retains the intended
purpose while reaching a route prefix. The existing travel hook checks companion
presence and accepted purpose before spending time, food, fare or risk. Refusal
is logged and shown through the existing notification surface. MOVE_PLAYER
revalidates the record and saves a pending journey rather than moving old feet.
The original departure, identity, goals, agreement and belongings remain separate.

At the destination, partyJourneyArrival reuses initialTownEntry's body admission.
Towns still require public geometry. Wilderness omits that town-only requirement;
dry ground, bounds, slope, occupied people, structures and visible parts remain
mandatory. Only a pending matching journey after its elapsed time can use this
path. A failed fit leaves arrival unresolved. The actual leader's first reached
footfall commits RECORD_COMPANION_ARRIVALS once, storing new feet and a shared
journey memory without approval gain. Existing saved points are not migrated.

The existing map supply quote now includes active companions' personal road
supplies. partyProvisions reserves food and water together, uses each person's
share and preserves unused stack attributes. Absent people supply neither goods
nor loyalty fallout. The old shared-bag path remains for parties without personal
provisions.51 affected cases/five suites and16 scoped paths pass, with a final
two-path check clean. This candidate has not yet been played across cells; actual
arrival, supplies, memory, refusal presentation and reload proof remain pending.

### Actual shared arrival and current limits

The source candidate is now played from Sedanes to the known temple cell. The
real17h18 journey preserves ordinary event/exhaustion consequences. Both bodies
render at independently admitted dry destination feet; original departure and
personal identity remain separate. One shared-journey arrival memory is stored.
Normal named Save/full document reload/explicit Load preserves31 checked groups,
including journey/feet/memory, world position, entry anchor and provision remainder.
All20 earlier named payloads stay byte-exact. The source personal-bag quote is
rendered, but no whole-day spend occurs on this leg; actual consumption is unproved.

Actual destination Talk still gives the earlier town-style recognition and terms
recall. It does not yet express the new shared event or a current opinion about
the next risk. That conversation/agency repair and actual cleric capability
inspection are the next connected gameplay step. Clear map-refusal feedback,
overflow continuity, personal supply use, skills/combat, restoration, disagreement,
return consequences and the complete arc remain open. See the living tracker's
actual shared temple journey receipt for the named payload and native proof.

## Spoken dialogue content and delivery order

Verified: 2026-10-29. `npcDialogueMemory.ts` publishes supported business, household-personal, generated-exchange and institution-statement speech into existing NPC interactions only after validating the current speaker, session and source. The stored words are attributed speech, not automatic `knownFacts` or world truth. Repeating the same words and source retains the original interaction ID, first date and history array. Optional `NpcMemory.lastSpokenDialogue` references the record and last successful delivery time, so repeating an older answer makes it the last discussed answer without rewriting history. Invalid/future pointers cannot manufacture text; a later original publication outranks a stale pointer. Generic recall respects authored refusal and current speaker identity. Legacy unrecorded utterances are not backfilled.

Institution statements join the living source priest to the actual retained dedication or uniquely matching succession event. Historical clergy listings remain historical after a succession; names alone do not join unrelated sellers to people in a chronicle. No private belief, ability or quest is inferred. For native RED/fix/full-reload evidence and current limitations, see [Clergy discussion and repeated-answer recall verified](../../projects/gameplay-flow/TRACKER.md#clergy-discussion-and-repeated-answer-recall-verified).

## Player-written resident speech

Verified: 2026-10-29. Ordinary resident DialogueInterface now offers an optional Say something textarea and Speak action through the shared DialogueConversationView footer. The existing generated-reply callback sanitizes the question and publishes the actual heard answer with its player input, request identity and speaker provenance into existing NPC memory. Free speech does not resolve an authored topic or award its mechanical effects. Authored graph conversations keep their exact choices. No generated statement becomes automatic world truth.

The current window owns a draft and one pending reply. Closing, unmounting or changing speaker invalidates pending publication; a different resident receives no old draft. Failed speech retains the question for a voice-only retry. Retrying an older question preserves a newer draft. Blank or over-limit input cannot submit. The existing topic, skill, trade, invitation and reply-retry paths remain. Design Preview uses the same optional composer with a deterministic fixture reply and no save/provider access.

The affected union passes 45 cases across seven suites. The three production/test paths and separate preview path each have zero scoped errors and zero suppressed diagnostics. The desktop preview is rendered and inspected at1440 by900 with no overflow or page error, and the original earned game remains exact at Main Menu. Native original Sana/Faelan source adoption now preserves18 PRESENT groups exactly. One actual written question and heard reply adds one attributed record without changing the previous five. Normal generic recall and full reload preserve17 PRESENT non-memory groups,75 NPC facts/histories,74 other complete memories and the last-delivery pointer exactly. The exact original input/output and IDs/dates/source survive, with no second model request and no new page error. The48.799-second CPU reply remains a responsiveness limit. See [Player-written follow-ups survive reload](../../projects/gameplay-flow/TRACKER.md#player-written-follow-ups-survive-reload) for the detailed native receipt and remaining story/service scope. See [Player-written resident follow-ups](../../projects/gameplay-flow/TRACKER.md#player-written-resident-follow-ups).

## Public-history referrals and heard directions

Verified: 2026-10-30. The living town priest's household_public_history topic locates a canonical public library in the current town. Existing local-direction identity/refusal checks and the legacy/folded building-use adapter gate the referral. Ruined, abandoned, private, malformed or future-reopened libraries are not offered. The answer does not invent a librarian, schedule, safe route or admission; the physical staffed desk reader owns those checks. It uses existing institution-statement memory, so repeated source/words keep original IDs and dates.

The existing dialogue hook records both generic directions and this heard referral as a stable, attributed Discovery Log entry. That note is the speaker's words, not a visit or world fact. Actual Sana/Faelan hearing, one read note and generic recall survive a full document reload with seven original dialogue records,75 fact/history arrays and17 other PRESENT groups exact. Source checks cover131 distinct cases; actual Rosa contact, library entrance and chronicle reading remain unqualified. See [The priest points to a real public library](../../projects/gameplay-flow/TRACKER.md#the-priest-points-to-a-real-public-library).

## Historical dialogue across venue packet IDs

Verified: 2026-10-31. Household dialogue history may be read from another NPC memory dictionary entry when the stored seven-field speaker stamp names that original entry and matches the current admitted world seed, town, household member, saved life and birth day exactly. The packet NPC ID is the only permitted difference. Authored NPCs keep exact-ID reading. Missing, malformed, future or mismatched provenance is refused. The reader never joins by display name.

The existing work, personal, generated and generic recall readers share this admission. Generic recall respects each original owner's last successful delivery pointer and preserves original record IDs, dates and words. Returning generated greetings and profile familiarity accept this qualified prior speech. All publishers still require the current complete speaker identity and active session/source checks, so an old-venue request cannot publish into a new contact.

This is read-only historical speech access. It does not copy or merge NPC memory, first-contact facts, disposition, trust, skills, quests, inventories or businesses. An old report remains an attributed historical report; current work claims still need current source evidence. World relayout migration, source-version binding and missing-person continuity remain open under GF-G93. See [Resident reunion and exact-life dialogue recall](../../projects/gameplay-flow/TRACKER.md#resident-reunion-and-exact-life-dialogue-recall) for the affected checks, exact normal source adoption and distinct native/runtime evidence.

## Discovering public plans before a new journey

Verified: 2026-10-31 for this flow. StartPointSelection optionally loads companionStartingLeadsForNewWorld, a read-only projection of the same companionActivitiesForNewWorld plans consumed by normal game initialization. It exposes only identity name, real town/cell and public activity summary. A matching town and cell are required. Selection affects only the player's pending start; no NPC, memory, goal or relationship is written. Old saved worlds are not initialized by this view. Loading/error states leave All towns available, and switching back clears a public-person query.

The desktop panel keeps map context and normal catalogue controls. With Back present, Begin gets a full-width row so long town names do not make a narrow three-line decision. Actual 1440 by 900 native and preview views are inspected. Twenty-three affected cases across three suites, a final thirteen-case UI rerun and scoped types qualify the source/selection behavior. One scoped header wave writes only the two changed source files.

Native separate-profile Gwyn selects Grangengen in world 1793432134128, walks normally to Kaelen's independently retained public point and earns one direct meeting. Two full document reloads preserve nineteen PRESENT groups and message prefixes exactly. Reopened dialogue recognizes her; a general invitation is refused and retained as one dated world-tagged companion memory. No contract or recruitment results. Kaelen's advertised paid work still needs concrete source-backed terms and a joint task (GF-G100). His public role is not evidence of every mechanical skill or his rendered likeness. Sana's older manual record remains byte-exact in its own context. See the owning [gameplay record](../../projects/gameplay-flow/TRACKER.md#public-plans-lead-to-an-independent-person) for exact clocks, resources, scope and ignored proof.

## Public work discussions before a contract

Verified: 2026-10-31. independentWorkConversation admits only the actual met/local Kaelen contact with his current-world seeking-independent-work activity and no party membership. CompanionTravelChoices exposes a deliberate discussion, then recall. applyCompanionTravelChoice rechecks contact and turn ownership, records one dated memory bound to the public activity source and full seed, and recalls the stated need for a concrete task, agreed pay and a return plan. It does not disclose private goals or mutate approval, funds, quests, membership or whereabouts. Missing legacy activity is not initialized. Existing generic recruitment and Elara's earned expedition consent remain separate.

Native desktop discussion, repeated recall and full document reload are verified for Gwyn in Grangengen. The source checks cover twenty-seven focused reducer cases and five clean scoped type paths. A normal town-map inspection identifies an off-duty innkeeper and real rooms/furnishings but is not a physical visit or a heard account. A paid commission and shared task remain unimplemented under GF-G100. See [Independent paid work can be discussed and recalled](../../projects/gameplay-flow/TRACKER.md#independent-paid-work-can-be-discussed-and-recalled) for exact saved-state proof, the expected later contact timestamp change and the separate protected Sana record.

## An innkeeper remembers her work and family

Verified: 2026-10-31. Native Gwyn reaches Grangengen inn plot 0 through the real open doorway. Its firsthand-public-visit record retains the keeper's original off-duty status. One normal short rest advances past 08:00 with its daily count and cooldown; current keeper/trade availability then follows the source shift. Nessa's working packet npc_burg_40_plot_0 retains household member b83:head, life 189 and birth day -17154. Her sourced introduction states innkeeper, ownership of The Golden Barrel and town office of priest. Her family statement names spouse Katla Fairbourne. An office grants no demonstrated spellcasting.

Her seven-field speaker identity and original four dialogue records survive a normal full reload with twenty-one exact PRESENT groups. Explicit family recall quotes her earlier words and direct recognition retains one first-meeting fact, disposition 50 and no duplicate dialogue record. The generated bandit exchange remains attributed hearsay without an inspected encounter binding. The public-history response instead binds actual library plot 56 and publishes one directions note. Grangengen currently has no canonical local dungeon legends; none is fabricated. The library is referred to, not visited. The owning [native receipt](../../projects/gameplay-flow/TRACKER.md#stowed-gear-clears-a-real-inn-doorway) preserves source identity, clocks and limits. Player render authority lives in [Entity Studio](entity-studio.md#empty-player-equipment-is-an-explicit-render-choice); native clearance messages live in [Town Map](town-map.md#vertical-clearance-notices).

## A companion arrives in the town that still owns its people

prepareHistoricalTownArrival shares the existing historical-town source comparison with load admission. It checks the destination before the normal travel hook spends anything. Its source receipt adds no party member, reputation, quest completion, private supply transfer or preselected arrival position. MOVE_PLAYER records the admitted layout/terrain before the destination ground mounts; ordinary placement then records each companion's actual arrived leg and memory. The saved town life, family ties, belongings, public work, private goals, consent and refusal remain authoritative.

A historical saved body keeps stricter support checks. A return that already mixed old town people with different streets is preserved as evidence, not silently teleported or rewritten. Exact-copy replay initialization is separate from the subsequent native travel and full-reload proof; it is not new-world generation or evidence that the original mixed return became loadable. Actual companion class skills, combat, restoration, meaningful disagreement/consequences and dismissal/reunion remain requirements of the full arc.


## Optional greetings and failed reply ownership

Verified: 2026-11-03 through source, focused checks and native greeting/request observation; native failure-alert/turn-release, normal End, grounded personal-plan recall and34-group full reload.

An optional generated greeting has an eight-second window before the source-grounded authored greeting opens. Its owner now cancels the generation fetch through the existing conversation facade, task router and chosen provider. Cancelling during model discovery prevents a later generation from starting. Local and cloud request timeouts remain distinct from cancellation, and model choices remain unchanged. Native Talk records an aborted browser request and the normal authored return greeting. Backend model-work release is not independently proved.

A talk intent completing successfully delivers the player line once, then the intent indicator ends. A failed companion reply yields the player turn and shows a separate alert; it adds no NPC words, trust or consent. The delivered player words stay in the transcript. A late result or failure from a different conversation cannot unlock or write into its replacement. This extends the existing pending/turn reducer rather than manufacturing an NPC reply to recover control. The native lockup that motivated it is archived. Repaired actual replay shows the failure alert, enabled controls and normal End; the pending-stage render no longer claims intent reading after classification. The companion Tracker retains the separate generated-response failure and full-arc gaps.


## Guarded following and a paid companion rest

Verified: 2026-11-03 through source,27 focused cases/four scoped type paths, actual desktop following/stairs/paid rest and34-group full reload.

PartyGroundActors accumulates leader displacement before clearing a blocked route and retries stationary obstructions at0.75-second intervals. A retry supplies the existing saved trail to PlayerAvatar's ground/body solver; it never assigns feet or grants passage. Only reported movement clears the blocked notice. Pausing, normal following distance, trail loss, physical collisions and consent remain unchanged. Native replay includes an actual body block, leader clearance, continued follower movement while the leader stands still, both stair flights and entry into the booked room.

PartyMemberCard presents the existing stranger tier (neutral approval0–99) as Neutral. Saved relationship level, approval, memories, thresholds and consent are unchanged. Native post-reload roster reads Neutral (+15).

A reserved guest bed opens the existing long-rest review at the player's actual supported bed reach. Actual played Room1 rest consumes the paid night once, restores eligible slots and uses each companion's own available provisions separately from shared supplies. It does not renew exploration consent, transfer private goods or complete restoration work. Full reload retains the used booking, depleted private meal, prior refusal and34 checked groups exactly. Cold revisit refuses reuse and now explains the matching used paid night without granting another rest; an active new reservation retains precedence. Existing cross-guest-room circulation and obstructed interior camera remain product gaps; successful passage does not approve either design. See [the played receipt](../../projects/gameplay-flow/TRACKER.md#a-paid-room-supports-a-real-companion-rest).


## Replenishment after the first promise

Verified: 2026-11-03 through37focused cases/seven scoped type paths, native request/handover/cold revisit and34-group full reload.

The fulfilled Road Preparations chapter remains fulfilled after consumption. Asking about preparations can reveal a new shortage grounded in the companion's actual personal inventory and active public restoration goal. A resupply-requested memory records her optional request. Only an unresolved request exposes the deliberate resupply choice. The existing atomic two-ration/two-water-day transfer preserves each stack's attributes, moves goods to her inventory and appends supplies-replenished; it grants no approval, quest reward, recruitment or entrance consent. Repeated asking cannot duplicate an open request, and already adequate personal stocks prevent another handover. Presence, remembered meeting, current-world chapter, player turn and both real resources are rechecked at commit. Her original promise and earlier refusals survive.

Actual played replenishment conserves shared and personal goods and both memories through full reload. Cold recall shows retained personal stock and no duplicate gift; its authored sentence still recalls the first promise rather than explicitly narrating the latest gift. Native dismissal/reunion and deeper restoration consequences remain unqualified. The affected reunion fixture separately caught a missing shared darkvision import; its bounded repair retains existing assembly intent and grants no new native recruitment proof. See [the played receipt](../../projects/gameplay-flow/TRACKER.md#replenish-personal-supplies-without-reopening-a-kept-promise).

## Town residents react to the player and ask for help

Verified: 2026-11-04, against `src/systems/social/npcLifeReactions.ts` and its tests.

A resident's attitude to the player is a stance: warm, friendly, neutral, wary, cold or shuns. `npcGreetingStance` scores the stored disposition, the good and bad talk this NPC heard about the player, a witnessed crime in this town and the resident's sim mood. The greeting prompt in `handleTalk` uses the stance. At "shuns" the NPC turns away and no conversation opens.

Both free-text lanes read the same stance from the current state through `npcChatAttitudeHint`. The dialogue window reply (`useDialogueSystem.generateResponse`) adds it to the system prompt. When the stance falls to "shuns" during a talk, that reply is the authored line "I have nothing more to say to you." and no model call is made. The conversation panel (`useConversation`) adds the stance to each non-companion speaker. Companions keep their own approval systems and get no stance line.

A resident can ask the player for help with one trouble at a time. `resolveResidentTrouble` checks the troubles in this order and offers the first that is not already in the quest log:

1. Fire: a town fire within 90 days, and the home still has unrepaired fire damage. The gift is 25 gold and adds 40 sim wealth.
2. Plague: a town plague within 90 days, the resident is not rich, and a spouse or child is alive. The gift is 15 gold and adds 15.
3. Grief: a spouse, child or parent died within 60 days, and the resident is not rich. The gift is 5 gold and adds 10.
4. Hardship: the resident's wealth is at or below the poor line. The gift is 10 gold and adds 30.

Every request is an ordinary Quest sent through OFFER_QUEST and ACCEPT_QUEST. A fire, plague or grief request id names its source chronicle event, so the same event never gives two requests. The hardship id names the sim year. HELP_TOWNSFOLK pays an accepted request in one step: the world slice charges the gold, adds the sim wealth and appends a `player_intervention` receipt; the quest slice completes the quest only when that receipt exists; the town slice records a donation deed as town talk. A replayed action, a stale quest or a short purse changes nothing.

Old saved towns get shop records on the next town entry (`fillShopsForSavedTown` in `townsim/shopLife.ts`), so shop succession and closure work there too. The fill writes no chronicle events. Open items are in GG-595, GG-596 and GG-617 in `docs/projects/GLOBAL_GAPS.md`.
