
/**
 * @file InventoryList.tsx
 * This component displays a list of inventory items with their details and actions.
 * It's used within the CharacterSheetModal.
 */
import React, { useMemo } from 'react';
import { PlayerCharacter, Item, Action } from '../types';
import { canEquipItem } from '../utils/characterUtils';
import Tooltip from './Tooltip';

interface InventoryListProps {
  inventory: Item[];
  gold: number;
  character: PlayerCharacter;
  onAction: (action: Action) => void;
}

const getItemTooltipContent = (item: Item): React.ReactNode => {
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
    details += `\nEffect: ${item.effect.replace(/_/g, ' ')}`;
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

const InventoryList: React.FC<InventoryListProps> = ({ inventory, gold, character, onAction }) => {
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

      {/* Weight & List Header */}
      <div className="flex justify-between items-center mb-2 px-1">
        <h3 className="font-semibold text-sky-400 text-sm">Backpack</h3>
        <span className="text-xs text-gray-400">Weight: {totalInventoryWeight} lbs</span>
      </div>

      {nonCoinInventory.length > 0 ? (
        <ul className="space-y-1.5 max-h-[calc(100vh-300px)] overflow-y-auto scrollable-content pr-1">
          {nonCoinInventory.map((item, index) => {
            // Using index in key because duplicate items are allowed
            const key = `${item.id}-${index}`;
            const { can: canBeEquipped, reason: cantEquipReason } =
              (item.type === 'armor' || item.type === 'weapon') && item.slot ?
                canEquipItem(character, item) : { can: false, reason: undefined };

            const isFood = item.type === 'food_drink';
            const isExpired = false; // Placeholder logic for now

            return (
              <li key={key} className="p-2.5 bg-gray-700/70 rounded-md shadow-sm border border-gray-600/50 flex items-center justify-between hover:bg-gray-600/70 transition-colors group">
                <div className="flex items-center flex-grow min-w-0">
                  {item.icon && <span className="text-xl mr-3 w-6 text-center flex-shrink-0 filter drop-shadow-sm">{item.icon}</span>}
                  <Tooltip content={getItemTooltipContent(item)}>
                    <div className="flex flex-col">
                      <span className="font-medium text-amber-200 text-sm cursor-help truncate group-hover:text-white transition-colors" title={item.name}>{item.name}</span>
                      {item.perishable && <span className="text-[10px] text-orange-300">Expires: {item.shelfLife || 'Unknown'}</span>}
                    </div>
                  </Tooltip>
                </div>
                <div className="flex gap-1.5 flex-shrink-0 ml-2">
                  {(item.type === 'consumable' || isFood) && (
                    <button onClick={() => onAction({ type: 'use_item', label: isFood ? `Eat ${item.name}` : `Use ${item.name}`, payload: { itemId: item.id, characterId: character.id! } })}
                      disabled={isExpired}
                      className="text-xs bg-green-700 hover:bg-green-600 text-white px-2 py-1 rounded disabled:bg-gray-600 transition-colors shadow-sm">
                      {isFood ? 'Eat' : 'Use'}
                    </button>
                  )}
                  {(item.type === 'armor' || item.type === 'weapon') && item.slot && (
                    <Tooltip content={canBeEquipped ? `Equip ${item.name}` : (cantEquipReason || "Cannot equip")}>
                      <button onClick={() => onAction({ type: 'EQUIP_ITEM', label: `Equip ${item.name}`, payload: { itemId: item.id, characterId: character.id! } })}
                        disabled={!canBeEquipped}
                        className="text-xs bg-sky-700 hover:bg-sky-600 text-white px-2 py-1 rounded disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors shadow-sm">
                        Equip
                      </button>
                    </Tooltip>
                  )}
                  <button onClick={() => onAction({ type: 'DROP_ITEM', label: `Drop ${item.name}`, payload: { itemId: item.id, characterId: character.id! } })}
                    className="text-xs bg-red-800 hover:bg-red-700 text-white px-2 py-1 rounded transition-colors shadow-sm">Drop</button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : <p className="text-sm text-gray-500 italic p-4 text-center border border-dashed border-gray-700 rounded">Backpack is empty.</p>}
    </div>
  );
};

export default InventoryList;
