/**
 * @file recipeFromCharacter.ts — a real character sheet → entity recipe.
 *
 * Maps the character's race id, class id, and equipped items so the player
 * (or a rich NPC) renders with the gear they actually wear instead of the
 * generic class kit. Slots without a visual mapping are simply not shown.
 */
import type { PlayerCharacter } from '../../types/character';
import type { RichNPC } from '../../types/world';
import type { Item } from '../../types/items';
import type { EntityRecipe, PartInstance } from './types';

function weaponPart(item: Item): PartInstance {
  const name = item.name.toLowerCase();
  const category = ('category' in item && typeof item.category === 'string' ? item.category : '').toLowerCase();
  if (category.includes('ranged') || /\b(bow|crossbow|sling)\b/.test(name)) {
    return { partId: 'bowMain', anchor: 'handL' };
  }
  if (/axe/.test(name)) return { partId: 'axeMain', anchor: 'handR' };
  if (/mace|hammer|club|morningstar|flail|pick/.test(name)) return { partId: 'maceMain', anchor: 'handR' };
  if (/dagger|sickle|dart|knife/.test(name)) return { partId: 'daggerMain', anchor: 'handR' };
  if (/staff|spear|trident|pike|glaive|halberd|lance|pole/.test(name)) return { partId: 'staffMain', anchor: 'handR' };
  return { partId: 'swordMain', anchor: 'handR' };
}

function armorCategoryOf(item: Item | undefined): string {
  return item && 'armorCategory' in item && typeof item.armorCategory === 'string'
    ? item.armorCategory
    : '';
}

/** Visible gear from the equipped-items slot map. */
export function gearFromEquippedItems(
  equippedItems: PlayerCharacter['equippedItems'] | undefined,
): PartInstance[] {
  if (!equippedItems) return [];
  const gear: PartInstance[] = [];
  const main = equippedItems.MainHand;
  if (main) gear.push(weaponPart(main));
  const off = equippedItems.OffHand;
  if (off) {
    if (armorCategoryOf(off) === 'Shield') {
      gear.push({ partId: 'shieldOff', anchor: 'handL' });
    } else if (off.type === 'weapon') {
      gear.push({ partId: 'daggerOff', anchor: 'handL' });
    }
  }
  const torsoCategory = armorCategoryOf(equippedItems.Torso);
  if (torsoCategory === 'Heavy') {
    gear.push({ partId: 'pauldrons', anchor: 'chest' }, { partId: 'helmet', anchor: 'head' });
  } else if (torsoCategory === 'Medium') {
    gear.push({ partId: 'pauldrons', anchor: 'chest' });
  } else if (torsoCategory === 'Light') {
    gear.push({ partId: 'capeCloak', anchor: 'back' });
  }
  if (equippedItems.Head && !gear.some((g) => g.anchor === 'head')) {
    gear.push({ partId: 'helmet', anchor: 'head' });
  }
  if (equippedItems.Cloak && !gear.some((g) => g.partId === 'capeCloak')) {
    gear.push({ partId: 'capeCloak', anchor: 'back' });
  }
  return gear;
}

/** Build the recipe for a real character. Seed defaults to the character id. */
export function recipeFromCharacter(pc: PlayerCharacter, seed?: string): EntityRecipe {
  const gear = gearFromEquippedItems(pc.equippedItems);
  return {
    kind: 'humanoid',
    raceId: pc.race.id,
    classId: pc.class.id,
    seed: seed ?? `pc:${pc.id ?? pc.name}`,
    ...(gear.length > 0 ? { gearOverride: gear } : {}),
  };
}

/** Build the recipe for a generated rich NPC. The NPC generator does not
 * persist a race id (and itself defaults unspecified NPCs to human), so the
 * recipe mirrors that; class and worn gear come from the NPC's real data. */
export function recipeFromRichNpc(npc: RichNPC): EntityRecipe {
  const gear = gearFromEquippedItems(npc.equippedItems);
  return {
    kind: 'humanoid',
    raceId: 'human',
    classId: npc.biography.classId,
    seed: `npc:${npc.id}`,
    ...(gear.length > 0 ? { gearOverride: gear } : {}),
  };
}
