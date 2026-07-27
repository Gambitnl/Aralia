/**
 * @file actionPaneGrouping.ts
 * Groups the flat context-action list into compact sections so a busy town
 * doesn't spam ~15 near-identical buttons ("Talk to X", "Ask X to join you",
 * "Browse Goods — …" per keeper). Pure + tested so the classification is locked
 * without rendering.
 *
 * Sections:
 *  - people: one entry per NPC present, each with a primary Talk action and any
 *    secondary person actions (invite to party, hire) — the name is shown once
 *    as the group, not repeated in every button.
 *  - shops:  the "Browse Goods — <store>" merchant actions, listed by store.
 *  - other:  everything else (take item, search, notice board, locks, …).
 */
import type { Action, NPC } from '../../types';
export interface PersonGroup {
    npcId: string;
    name: string;
    /** The plain "Talk to X" action (primary, one-click). May be absent. */
    talk?: Action;
    /** Secondary person actions: invite-to-party, hire. */
    secondary: Action[];
}
export interface GroupedActions {
    people: PersonGroup[];
    shops: Action[];
    other: Action[];
}
/**
 * Partition context actions into people / shops / other. People are ordered to
 * match `npcs`; only NPCs that actually have an action appear.
 */
export declare function groupActionPaneActions(actions: Action[], npcs: NPC[]): GroupedActions;
/**
 * Short button text for a person's action, since the name is already the group
 * header. The full `action.label` is still what gets dispatched.
 */
export declare function shortPersonActionLabel(action: Action): string;
