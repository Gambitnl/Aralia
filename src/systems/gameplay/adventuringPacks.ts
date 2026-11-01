/** Opens an owned, cataloged bundle through the existing inventory transaction.
 * Old saves stay sealed until the player chooses to open one. Custom, enchanted
 * and quest-bearing packs remain intact; their contents need their own manifest. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 16:19:11
 * Dependents: components/CharacterSheet/Overview/AdventuringPackReview.tsx, hooks/actions/handleItemInteraction.ts, state/reducers/characterReducer.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {ALL_ITEMS} from '../../data/items';
import {ADVENTURING_GEAR} from '../../data/items/adventuringGear';
import {GamePhase, ItemType, type GameState, type Item, type UseItemPayload} from '../../types';
import {inventoryWeight} from '../travel/provisionEncumbrance';
import {parseCost} from '../../utils/economy/economyUtils';

export interface AdventuringPackOffer {
  name: string;
  quantity: number;
  unitWeight: number;
  contents: Item[];
  /** Explain what remains bundled when some components have no loose catalog identity. */
  retainedContents?: string;
  error?: string;
}

/** Manifests follow the actual authored starting packs, rather than generated
 * glossary bundles with similar names and different quantities. Priest ritual
 * components remain bundled until they have their own cataloged behavior. */
export function adventuringPackOffer(item: Item): AdventuringPackOffer|null {
  if (item.id !== 'explorers_pack' && item.id !== 'priests_pack') return null;
  const priest = item.id === 'priests_pack';
  const offer: AdventuringPackOffer = {name:item.name, quantity:item.quantity ?? 1, unitWeight:item.weight ?? 0, contents:[]};
  const refuse = (error:string):AdventuringPackOffer => ({...offer,error});
  const catalog = ADVENTURING_GEAR[item.id];
  if (item.name !== catalog.name || item.description !== catalog.description || item.type !== ItemType.Tool ||
      item.magicProperties || item.requiresAttunement || item.questHooks || item.readableContent || 'isContainer' in item) {
    return refuse('This particular pack has special or unverified contents. It must stay intact.');
  }
  if (!Number.isSafeInteger(offer.quantity) || offer.quantity < 1) return refuse('That bundle is no longer carried.');
  if (!Number.isFinite(item.weight) || item.weight! <= 0) return refuse('The carrying weight of this pack is unknown.');
  // Only remove cataloged supplies from the priest's bundle. Its blanket and
  // ritual gear stay together: no invented weights, prices or missing pieces.
  const manifest: [string,number][] = priest
    ? [['backpack',1],['tinderbox',1],['rations',2],['waterskin',1]]
    : [['backpack',1],['bedroll',1],['mess_kit',1],['tinderbox',1],
    ['torch',10],['rations',10],['waterskin',1],['rope',1]];
  for (const [id,quantity] of manifest) {
    const template = ALL_ITEMS[id];
    if (!template || !Number.isFinite(template.weight) || template.weight! < 0) return refuse('Some contents of this pack are not cataloged yet.');
    // Pack contents are carried tools. Since GG-543 and GG-576 the generated
    // glossary already types most Adventuring Gear as tool with no slot; this
    // override still forces tool and clears any slot, so a hand-authored
    // ALL_ITEMS entry with another type cannot change a pack's contents.
    const tool = !['torch','rations'].includes(id);
    offer.contents.push({...template,quantity,...(tool ? {type:ItemType.Tool,slot:undefined} : {})});
  }
  const backpack = offer.contents[0];
  const retainedWeight = offer.unitWeight - inventoryWeight(offer.contents.slice(1));
  if (retainedWeight < backpack.weight! - 1e-8) return refuse('The recorded pack weight cannot account for these contents. It stays intact.');
  // Keep the recorded carrying mass. The retained backpack includes remaining
  // packing/straps, rather than deleting the bundle's unexplained extra pound.
  offer.contents[0] = {...backpack,weight:retainedWeight,
    description:'The backpack retained from an Explorer\'s Pack. Its carrying weight includes the remaining packing and straps.'};
  if (priest) {
    const sourceValue = item.costInGp ?? parseCost(item.cost);
    const removedValue = offer.contents.slice(1).reduce((sum,part)=>sum+(part.costInGp ?? parseCost(part.cost))*(part.quantity ?? 1),0);
    if (!Number.isFinite(sourceValue) || sourceValue < removedValue) return refuse('The recorded kit value cannot account for these supplies. It stays intact.');
    offer.retainedContents = 'The backpack retains the blanket, an alms box, 2 blocks of incense, a censer, and vestments. They remain together as a ritual kit.';
    offer.contents[0] = {...backpack,name:"Priest's Pack — retained kit",weight:retainedWeight,
      costInGp:sourceValue-removedValue,cost:`${sourceValue-removedValue} GP`,
      description:offer.retainedContents};
  }
  return offer;
}

export function adventuringPackUseError(state: GameState, request: UseItemPayload): string|null {
  if (state.phase !== GamePhase.PLAYING) return 'Open your pack outside battle.';
  const member = state.party.find(person => person.id === request.characterId);
  const unable = new Set(['incapacitated','unconscious','paralyzed','stunned']);
  if (!member || member.hp <= 0 || member.conditions?.some(c=>unable.has(c.toLowerCase())) ||
      member.statusEffects?.some(effect=>unable.has(effect.name.toLowerCase()))) return 'That character cannot open a pack now.';
  const index = request.inventoryIndex;
  if (!Number.isSafeInteger(index) || index! < 0 || !request.unpack ||
      state.inventory[index!] !== request.unpack.sourceItem || state.inventory[index!]?.id !== request.itemId) return 'That selected bundle has changed. Review it again.';
  const offer = adventuringPackOffer(state.inventory[index!]);
  if (!offer) return 'This item is not a cataloged expedition pack.';
  if (offer.error) return offer.error;
  if (!Number.isFinite(state.gameTime.getTime())) return 'The world clock is unavailable; the pack stays sealed.';
  return null;
}

/** One selected unit becomes its real supplies and one unique empty container.
 * Food keeps its acquisition age, stolen status and source. A waterskin is not
 * silently converted into a fresh day of drinking water or any recovery. */
export function prepareAdventuringPack(state:GameState, request:UseItemPayload): {patch:Partial<GameState>}|{error:string} {
  const error = adventuringPackUseError(state,request);
  if (error) return {error};
  const openingId = request.unpack!.openingId;
  const backpackId = 'backpack:unpacked:'+openingId;
  if (!openingId || state.inventory.some(item=>item.id===backpackId)) return {error:'This pack opening is already recorded. Review the remaining bundle.'};
  const index = request.inventoryIndex!, source = state.inventory[index], offer = adventuringPackOffer(source)!;
  const unpackedFrom = {openingId,sourceItem:{...source,quantity:1},gameTime:state.gameTime.toISOString()};
  const contents = offer.contents.map((item,i)=>({...item,
    acquiredAt:source.acquiredAt,provenance:source.provenance,isStolen:source.isStolen,isJunk:source.isJunk,
    containerId:source.containerId,unpackedFrom,
    ...(i===0 ? {id:backpackId,isContainer:true as const,
      // The retained priest's gear already occupies part of its carrying room.
      capacityWeight:offer.retainedContents ? Math.max(0,30-(item.weight! - ALL_ITEMS.backpack.weight!)) : 30,
      contents:[]} : {})}));
  const inventory = [...state.inventory];
  if ((source.quantity ?? 1)>1) inventory[index] = {...source,quantity:source.quantity!-1};
  else inventory.splice(index,1);
  inventory.push(...contents);
  return {patch:{inventory}};
}
