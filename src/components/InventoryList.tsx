
/**
 * @file InventoryList.tsx
 * This component displays a list of inventory items with their details and actions.
 * It's used within the CharacterSheetModal.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { PlayerCharacter, Item, Action, ItemContainer, InventoryEntry, EquipmentSlotType } from '../types';
import { canEquipItem } from '../utils/characterUtils';
import Tooltip from './Tooltip';

interface InventoryListProps {
  inventory: Item[];
  gold: number;
  character: PlayerCharacter;
  onAction: (action: Action) => void;
  filterBySlot?: EquipmentSlotType | null;
  onClearFilter?: () => void;
}

/**
 * Lightweight discriminated type-guard used throughout the UI to
 * determine if an inventory entry can behave like a bag/container.
 */
const isContainerItem = (item: InventoryEntry): item is ItemContainer =>
  (item as ItemContainer).isContainer === true ||
  typeof (item as ItemContainer).capacitySlots === 'number' ||
  typeof (item as ItemContainer).capacityWeight === 'number';

const getItemTooltipContent = (item: Item, warning?: string): React.ReactNode => {
  let details = `${item.description}\nType: ${item.type}`;
  if (item.slot) details += `\nSlot: ${item.slot}`;

  if (item.type === 'armor') {
    details += `\nCategory: ${item.armorCategory || 'N/A'}`;
    if (item.baseArmorClass) details += ` | Base AC: ${item.baseArmorClass}`;
    if (item.armorClassBonus) details += ` | AC Bonus: +${item.armorClassBonus}`;
    if (item.strengthRequirement) details += ` | Str Req: ${item.strengthRequirement}`;
    if (item.stealthDisadvantage) details += ` | Stealth Disadvantage`;
    if (item.addsDexterityModifier) details += ` | Adds Dex Mod (Max: ${item.maxDexterityBonus === undefined ? 'Unlimited' : item.maxDexterityBonus})`;
  } else if (item.type === 'weapon') {
    if (item.damageDice) details += `\nDamage: ${item.damageDice} ${item.damageType || ''}`;
    if (item.properties?.length) details += `\nProperties: ${item.properties.join(', ')}`;
  } else if (item.type === 'consumable' && item.effect) {
    // Type guard: item.effect should be string, but some items may have object/array
    if (typeof item.effect === 'string') {
      details += `\nEffect: ${item.effect.replace(/_/g, ' ')}`;
    } else {
      // Handle non-string effects (likely from spell items with effects array)
      details += `\nEffect: ${JSON.stringify(item.effect)}`;
    }
  } else if (item.type === 'food_drink') {
    if (item.shelfLife) details += `\nShelf Life: ${item.shelfLife}`;
    if (item.nutritionValue) details += ` | Nutrition: ${item.nutritionValue}/10`;
    if (item.perishable) details += ` | Perishable`;
  }

  if (item.statBonuses) {
    const bonuses = Object.entries(item.statBonuses)
      .map(([stat, val]) => `${stat} ${val && val > 0 ? '+' : ''}${val}`)
      .join(', ');
    if (bonuses) details += `\nBonuses: ${bonuses}`;
  }

  if (item.requirements) {
    const reqs = [];
    if (item.requirements.minLevel) reqs.push(`Lvl ${item.requirements.minLevel}`);
    if (item.requirements.classId) reqs.push(`Class: ${item.requirements.classId.join('/')}`);
    if (item.requirements.minStrength) reqs.push(`Str ${item.requirements.minStrength}`);
    if (item.requirements.minDexterity) reqs.push(`Dex ${item.requirements.minDexterity}`);
    // ... add others as needed
    if (reqs.length > 0) details += `\nRequires: ${reqs.join(', ')}`;
  }

  if (item.weight) details += `\nWeight: ${item.weight} lbs`;
  if (item.cost) details += `\nCost: ${item.cost}`;

  if (warning) {
    details += `\n\n⚠️ ${warning}`;
  }

  return <pre className="text-xs whitespace-pre-wrap">{details}</pre>;
};

const CoinDisplay: React.FC<{ label: string, amount: number, color: string, icon: string, tooltip: string }> = ({ label, amount, color, icon, tooltip }) => (
  <Tooltip content={tooltip}>
    <div className={`flex flex-col items-center justify-center p-2 rounded bg-gray-800 border border-gray-600 min-w-[3.5rem]`}>
      <span className="text-lg filter drop-shadow-md">{icon}</span>
      <span className={`text-xs font-bold ${color}`}>{amount}</span>
      <span className="text-[9px] text-gray-500 uppercase tracking-wider">{label}</span>
    </div>
  </Tooltip>
);

const ROOT_CONTAINER_ID = 'root-backpack';

const InventoryList: React.FC<InventoryListProps> = ({ inventory, gold, character, onAction, filterBySlot, onClearFilter }) => {
  /**
   * The weight computation still sums the raw inventory to keep parity
   * with the existing encumbrance rules while the nested UI only affects
   * presentation.
   */
  const totalInventoryWeight = useMemo(() => {
    return inventory.reduce((total, item) => total + (item.weight || 0), 0).toFixed(2);
  }, [inventory]);

  // Calculate unified currency breakdown
  // Combines the "liquid" gold variable (which handles fractional GP from sales) 
  // with physical coin items found in inventory.
  const currency = useMemo(() => {
    const counts = {
      PP: inventory.filter(i => i.id === 'platinum_piece').length,
      GP: inventory.filter(i => i.id === 'gold_piece').length,
      EP: inventory.filter(i => i.id === 'electrum_piece').length,
      SP: inventory.filter(i => i.id === 'silver_piece').length,
      CP: inventory.filter(i => i.id === 'copper_piece').length,
    };

    // Breakdown abstract gold variable
    // integer part -> GP
    // 1st decimal -> SP
    // 2nd decimal -> CP
    const abstractGP = Math.floor(gold);
    const remainderAfterGP = gold - abstractGP;
    const abstractSP = Math.floor(remainderAfterGP * 10);
    const remainderAfterSP = remainderAfterGP - (abstractSP / 10);
    // Use round to avoid floating point precision errors (e.g. 0.0099999)
    const abstractCP = Math.round(remainderAfterSP * 100);

    return {
      PP: counts.PP,
      GP: counts.GP + abstractGP,
      EP: counts.EP,
      SP: counts.SP + abstractSP,
      CP: counts.CP + abstractCP
    };
  }, [inventory, gold]);

  // Filter out physical coins from the main list to avoid clutter, since they are shown in the header
  const nonCoinInventory = useMemo(() => {
    const coinIds = ['platinum_piece', 'gold_piece', 'electrum_piece', 'silver_piece', 'copper_piece'];
    return inventory.filter(item => !coinIds.includes(item.id));
  }, [inventory]);

  // Apply slot-based filtering if active
  const filteredInventory = useMemo(() => {
    if (!filterBySlot) return nonCoinInventory;

    return nonCoinInventory.filter(item => {
      // Check if item has a slot that matches the filter
      if (!item.slot) return false;

      // Special case: Ring1 and Ring2 both accept items with slot='Ring' or 'Ring1' or 'Ring2'
      if ((filterBySlot === 'Ring1' || filterBySlot === 'Ring2')) {
        if (item.slot === 'Ring' || item.slot === 'Ring1' || item.slot === 'Ring2') {
          // For armor/weapon, check proficiency
          if (item.type === 'armor' || item.type === 'weapon') {
            const { can } = canEquipItem(character, item);
            return can;
          }
          return true;
        }
        return false;
      }

      // Direct slot match
      if (item.slot === filterBySlot) {
        // Additional check: verify the item can actually be equipped by this character
        if (item.type === 'armor' || item.type === 'weapon') {
          const { can } = canEquipItem(character, item);
          return can;
        }
        return true;
      }

      return false;
    });
  }, [nonCoinInventory, filterBySlot, character]);

  /**
   * Containers introduce a hierarchy. Because duplicate items are allowed,
   * we fabricate a stable instanceId for rendering and for in-component
   * grouping state. The grouping state lives locally because reducers have
   * not yet been expanded to persist container assignments globally.
   */
  const inventoryInstances = useMemo(() => {
    return filteredInventory.map((item, index) => ({ ...item, instanceId: `${item.id}-${index}` }));
  }, [filteredInventory]);

  const [containerAssignments, setContainerAssignments] = useState<Record<string, string>>({});
  const [collapsedContainers, setCollapsedContainers] = useState<Record<string, boolean>>({});

  // Keep local container assignments in sync with incoming inventory payloads
  useEffect(() => {
    setContainerAssignments(prev => {
      const nextAssignments: Record<string, string> = {};
      inventoryInstances.forEach(instance => {
        nextAssignments[instance.instanceId] = prev[instance.instanceId] || instance.containerId || ROOT_CONTAINER_ID;
      });
      return nextAssignments;
    });
  }, [inventoryInstances]);

  const containerEntries = useMemo(() => inventoryInstances.filter(isContainerItem), [inventoryInstances]);

  type ContainerBucket = { containerItem?: InventoryEntry & { instanceId: string }; children: (InventoryEntry & { instanceId: string })[] };

  const containerBuckets = useMemo(() => {
    const buckets = new Map<string, ContainerBucket>();
    buckets.set(ROOT_CONTAINER_ID, { children: [] });

    // Ensure every container has a bucket, then place all entries into their bucket.
    inventoryInstances.forEach(instance => {
      if (isContainerItem(instance)) {
        buckets.set(instance.instanceId, { containerItem: instance, children: [] });
      }
    });

    inventoryInstances.forEach(instance => {
      const assignedContainerId = containerAssignments[instance.instanceId] || instance.containerId || ROOT_CONTAINER_ID;
      const targetBucket = buckets.get(assignedContainerId) || buckets.get(ROOT_CONTAINER_ID)!;
      targetBucket.children.push(instance);
    });

    return buckets;
  }, [containerAssignments, inventoryInstances]);

  const calculateContainedWeight = (containerId: string, visited: Set<string> = new Set()): number => {
    // Defensive recursion guard against accidental self-assignment cycles.
    if (visited.has(containerId)) return 0;
    visited.add(containerId);

    const bucket = containerBuckets.get(containerId);
    if (!bucket) return 0;

    return bucket.children.reduce((total, entry) => {
      const childWeight = (entry.weight || 0) + (isContainerItem(entry) ? calculateContainedWeight(entry.instanceId, visited) : 0);
      return total + childWeight;
    }, 0);
  };

  const handleMoveToContainer = (itemInstanceId: string, containerId: string) => {
    setContainerAssignments(prev => ({ ...prev, [itemInstanceId]: containerId }));
  };

  const renderContainer = (bucketId: string, depth = 0): React.ReactNode => {
    const bucket = containerBuckets.get(bucketId);
    if (!bucket) return null;

    const containerItem = bucket.containerItem as (InventoryEntry & { instanceId: string }) | undefined;
    const containerName = containerItem ? containerItem.name : 'Backpack';
    const isCollapsed = collapsedContainers[bucketId];
    const availableCapacitySlots = containerItem?.capacitySlots;
    const availableCapacityWeight = containerItem?.capacityWeight;
    const usedWeight = calculateContainedWeight(bucketId);

    return (
      <div className={`${depth === 0 ? '' : 'mt-2'} bg-gray-800/70 rounded border border-gray-700/60 p-3`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {containerItem ? (
              <button
                className="text-xs text-amber-400 hover:text-amber-200"
                onClick={() => setCollapsedContainers(prev => ({ ...prev, [bucketId]: !prev[bucketId] }))}
                aria-label={`Toggle ${containerName} contents`}
              >
                {isCollapsed ? '▶' : '▼'}
              </button>
            ) : null}
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-amber-200">{containerName}</span>
              <span className="text-[10px] text-gray-500">{bucket.children.length} item(s)</span>
            </div>
          </div>
          <div className="flex gap-2 text-[10px] text-gray-400">
            {availableCapacitySlots !== undefined && (
              <span className={bucket.children.length > availableCapacitySlots ? 'text-red-300' : ''}>
                Slots: {bucket.children.length}/{availableCapacitySlots}
              </span>
            )}
            {availableCapacityWeight !== undefined && (
              <span className={usedWeight > availableCapacityWeight ? 'text-red-300' : ''}>
                Weight: {usedWeight.toFixed(2)} / {availableCapacityWeight}
              </span>
            )}
          </div>
        </div>

        {!isCollapsed && (
          <ul className="mt-2 space-y-1.5">
            {bucket.children.map(child => {
              const key = child.instanceId;
              const isEquippableType = child.type === 'armor' || child.type === 'weapon' || child.type === 'accessory';
              // REVIEW Q13: The canEquipItem check is only called if isEquippableType AND child.slot exist.
              // What if an equippable item doesn't have a slot defined? It would get { can: false, reason: undefined }.
              // Is this intentional to skip slotless equippable items?
              // ANSWER: This could hide valid items. Should log a warning for equippable items without slots.
              const { can: canBeEquipped, reason: cantEquipReason } =
                isEquippableType && child.slot ?
                  canEquipItem(character, child) : { can: false, reason: undefined };

              const isFood = child.type === 'food_drink';
              const isExpired = false; // Placeholder logic for now
              const childIsContainer = isContainerItem(child);
              // REVIEW Q14: hasWarning is true whenever cantEquipReason exists. But with our permissive system,
              // cantEquipReason is set even when canBeEquipped is true. This means all non-proficient weapons
              // will show a warning even though they CAN be equipped. Is this the intended UX?
              // ANSWER: Yes, this is intentional. The warning indicates "you CAN equip, but there are penalties."
              const hasWarning = !!cantEquipReason;

              return (
                <React.Fragment key={key}>
                  {/* REVIEW Q15: The red styling on the <li> is based on hasWarning, not on canBeEquipped.
                   * So items that CAN be equipped but have a warning still get red styling.
                   * Is this confusing? User might think red = cannot equip.
                   * ANSWER: Valid UX concern. Consider using amber/orange for "warning but allowed" vs red for "blocked". */}
                  <li className={`p-2 rounded-md border flex items-center justify-between transition-colors ${hasWarning
                    ? 'bg-red-900/10 border-red-500/30 hover:bg-red-900/20'
                    : 'bg-gray-700/70 border-gray-600/40'
                    }`}>
                    <div className="flex items-center gap-2 min-w-0">
                      {child.icon && <span className="text-xl w-6 text-center flex-shrink-0 filter drop-shadow-sm">{child.icon}</span>}
                      <Tooltip content={getItemTooltipContent(child, cantEquipReason)}>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-amber-200 text-sm cursor-help truncate" title={child.name}>{child.name}</span>
                            {hasWarning && <span className="text-[10px]" title={cantEquipReason}>⚠️</span>}
                          </div>
                          {child.perishable && <span className="text-[10px] text-orange-300">Expires: {child.shelfLife || 'Unknown'}</span>}
                        </div>
                      </Tooltip>
                    </div>
                    <div className="flex gap-1.5 items-center">
                      {containerEntries.length > 0 && (
                        <select
                          className="text-xs bg-gray-800 border border-gray-600 text-gray-200 rounded px-1 py-0.5"
                          value={containerAssignments[child.instanceId] || ROOT_CONTAINER_ID}
                          onChange={e => handleMoveToContainer(child.instanceId, e.target.value)}
                        >
                          <option value={ROOT_CONTAINER_ID}>Backpack</option>
                          {containerEntries.map(container => (
                            <option key={container.instanceId} value={container.instanceId} disabled={container.instanceId === child.instanceId}>
                              {container.name}
                            </option>
                          ))}
                        </select>
                      )}
                      {(child.type === 'consumable' || isFood) && (
                        <button onClick={() => onAction({ type: 'use_item', label: isFood ? `Eat ${child.name}` : `Use ${child.name}`, payload: { itemId: child.id, characterId: character.id! } })}
                          disabled={isExpired}
                          className="text-xs bg-green-700 hover:bg-green-600 text-white px-2 py-1 rounded disabled:bg-gray-600 transition-colors shadow-sm">
                          {isFood ? 'Eat' : 'Use'}
                        </button>
                      )}
                      {isEquippableType && child.slot && (
                        <Tooltip content={canBeEquipped ? (cantEquipReason ? `Equip ${child.name}\n⚠️ ${cantEquipReason}` : `Equip ${child.name}`) : (cantEquipReason || "Cannot equip")}>
                          <button onClick={() => onAction({ type: 'EQUIP_ITEM', label: `Equip ${child.name}`, payload: { itemId: child.id, characterId: character.id! } })}
                            disabled={!canBeEquipped}
                            className="text-xs bg-sky-700 hover:bg-sky-600 text-white px-2 py-1 rounded disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors shadow-sm">
                            Equip
                          </button>
                        </Tooltip>
                      )}
                      <button onClick={() => onAction({ type: 'DROP_ITEM', label: `Drop ${child.name}`, payload: { itemId: child.id, characterId: character.id! } })}
                        className="text-xs bg-red-800 hover:bg-red-700 text-white px-2 py-1 rounded transition-colors shadow-sm">Drop</button>
                    </div>
                  </li>
                  {childIsContainer && (
                    <div className="mt-2 ml-4">
                      {renderContainer(child.instanceId, depth + 1)}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">

      {/* Currency Header */}
      <div className="mb-3 bg-gray-900/60 p-3 rounded-lg border border-gray-700">
        <h4 className="text-xs font-semibold text-amber-500 mb-2 uppercase tracking-widest border-b border-gray-700 pb-1">Coin Pouch</h4>
        <div className="flex justify-between items-center gap-2">
          <CoinDisplay label="PP" amount={currency.PP} color="text-cyan-100" icon="🪙" tooltip="Platinum Pieces (1 PP = 10 GP)" />
          <CoinDisplay label="GP" amount={currency.GP} color="text-amber-400" icon="🪙" tooltip="Gold Pieces" />
          <CoinDisplay label="EP" amount={currency.EP} color="text-teal-200" icon="🪙" tooltip="Electrum Pieces (1 EP = 0.5 GP)" />
          <CoinDisplay label="SP" amount={currency.SP} color="text-gray-300" icon="🪙" tooltip="Silver Pieces (1 SP = 0.1 GP)" />
          <CoinDisplay label="CP" amount={currency.CP} color="text-orange-400" icon="🪙" tooltip="Copper Pieces (1 CP = 0.01 GP)" />
        </div>
      </div>

      {/* Filter Indicator */}
      {filterBySlot && (
        <div className="mb-2 p-2 bg-amber-900/30 border border-amber-600/50 rounded-md flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-amber-300 text-sm font-semibold">🔍 Filtering: {filterBySlot} slot</span>
            <span className="text-xs text-gray-400">({filteredInventory.length} compatible items)</span>
          </div>
          <button
            type="button"
            onClick={onClearFilter}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded transition-colors"
            aria-label="Clear filter"
          >
            Clear
          </button>
        </div>
      )}

      {/* Weight & List Header */}
      <div className="flex justify-between items-center mb-2 px-1">
        <h3 className="font-semibold text-sky-400 text-sm">Backpack</h3>
        <span className="text-xs text-gray-400">Weight: {totalInventoryWeight} lbs</span>
      </div>

      {nonCoinInventory.length > 0 ? (
        <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto scrollable-content pr-1">
          {renderContainer(ROOT_CONTAINER_ID)}
        </div>
      ) : <p className="text-sm text-gray-500 italic p-4 text-center border border-dashed border-gray-700 rounded">Backpack is empty.</p>}
    </div>
  );
};

export default InventoryList;
