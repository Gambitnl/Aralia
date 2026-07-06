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

/** The NPC id an action targets, or undefined if it isn't NPC-scoped. */
function actionNpcId(action: Action): string | undefined {
  const withTarget = action as { targetId?: string; payload?: { targetNpcId?: string; buildingId?: string } };
  return withTarget.targetId ?? withTarget.payload?.targetNpcId ?? withTarget.payload?.buildingId;
}

function isRecruitTalk(action: Action): boolean {
  return action.type === 'talk' && Boolean((action.payload as { recruitOffer?: unknown } | undefined)?.recruitOffer);
}

function isHire(action: Action): boolean {
  return action.type === 'OPEN_DYNAMIC_MERCHANT' && Boolean((action.payload as { hire?: boolean } | undefined)?.hire);
}

function isBrowseShop(action: Action): boolean {
  return action.type === 'OPEN_DYNAMIC_MERCHANT' && !isHire(action);
}

/**
 * Partition context actions into people / shops / other. People are ordered to
 * match `npcs`; only NPCs that actually have an action appear.
 */
export function groupActionPaneActions(actions: Action[], npcs: NPC[]): GroupedActions {
  const groups = new Map<string, PersonGroup>();
  for (const npc of npcs) groups.set(npc.id, { npcId: npc.id, name: npc.name, secondary: [] });

  const shops: Action[] = [];
  const other: Action[] = [];

  for (const action of actions) {
    const npcId = actionNpcId(action);
    const group = npcId ? groups.get(npcId) : undefined;

    if (isBrowseShop(action)) {
      shops.push(action);
      continue;
    }

    if (group && action.type === 'talk') {
      if (isRecruitTalk(action)) group.secondary.push(action);
      else group.talk = action;
      continue;
    }

    if (group && isHire(action)) {
      group.secondary.push(action);
      continue;
    }

    other.push(action);
  }

  const people = npcs
    .map((npc) => groups.get(npc.id)!)
    .filter((g) => g.talk || g.secondary.length > 0);

  return { people, shops, other };
}

/**
 * Short button text for a person's action, since the name is already the group
 * header. The full `action.label` is still what gets dispatched.
 */
export function shortPersonActionLabel(action: Action): string {
  if (isHire(action)) return 'Hire';
  if (isRecruitTalk(action)) return 'Ask to join';
  if (action.type === 'talk') return 'Talk';
  return action.label ?? 'Interact';
}
