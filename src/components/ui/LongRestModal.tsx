// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 13:21:36
 * Dependents: components/layout/GameModals.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { planRestMeals } from '../../systems/gameplay/restMeals';
import type { GameState } from '../../types/state';
/**
 * @file LongRestModal.tsx
 * Long rest modal for prompting and applying racial choices during a long rest.
 * @component-owner Gameplay Team / Core UI
 */

import React, { useEffect, useState } from 'react';
import { PlayerCharacter, RacialRestChoiceData, Item } from '../../types';
import { getRulesEdition, type RulesEdition } from '../../config/rulesEdition';
import { preparationPlanError, preparationMinutes } from '../../systems/gameplay/spellPreparation';
import { ModalDialog } from './ModalDialog';
// GG-378: shared button style and control roles.
import { Button } from './Button';
import { BTN_ICON } from '../../styles/buttonStyles';

interface LongRestModalProps {
  isOpen: boolean;
  party: PlayerCharacter[];
  onClose: () => void;
  onConfirm: (choices: Record<string, Record<string, RacialRestChoiceData>>) => void | Promise<void>;
  inventory?: Item[];
  companions?: GameState['companions'];
  gameTime?: Date;
  lastLongRestAt?: string | null;
  lodgingName?: string;
  locationError?: string | null;
  restWarning?: string | null;
  waitLocationError?: string | null;
  rulesEdition?: RulesEdition;
  onWait?: (seconds: number) => void | Promise<void>;
}

/** Ordinary waiting may end before a shop opens. Keep the existing 24-hour
 * limit and seconds action; this grants neither recovery nor property consent. */
function ordinaryWaitSeconds(hours: number, minutes: number): number {
  const whole = (value: number, max: number) => Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0;
  return Math.min(24 * 3600, whole(hours, 24) * 3600 + whole(minutes, 59) * 60);
}

const LongRestModal: React.FC<LongRestModalProps> = ({ isOpen, party, onClose, onConfirm, inventory = [], companions = {}, gameTime, lastLongRestAt, rulesEdition, onWait, lodgingName, locationError, waitLocationError, restWarning }) => {
  const [choices, setChoices] = useState<Record<string, Record<string, RacialRestChoiceData>>>({});

  const [isResting, setIsResting] = useState(false);
  const pending = React.useRef(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [hoursToWait, setHoursToWait] = useState(1);
  const [minutesToWait, setMinutesToWait] = useState(0);
  const waitSeconds = ordinaryWaitSeconds(hoursToWait, minutesToWait);
  const durationHours = Math.floor(waitSeconds / 3600), durationMinutes = (waitSeconds % 3600) / 60;
  const waitLabel = ['Wait', durationHours ? `${durationHours} hour(s)` : '', durationMinutes ? `${durationMinutes} minute(s)` : '', 'here'].filter(Boolean).join(' ');
  const [error, setError] = useState<string | null>(null);
  const currentMs = gameTime ? new Date(gameTime).getTime() : NaN;
  const lastMs = lastLongRestAt ? new Date(lastLongRestAt).getTime() : NaN;
  const waitHours = Number.isFinite(currentMs) && Number.isFinite(lastMs)
    ? Math.max(0, Math.ceil((lastMs + 16 * 3600000 - currentMs) / 3600000)) : 0;
  const noEligibleMembers = party.length === 0 || party.every(member => member.hp <= 0);
  const close = () => { if (!isResting) onClose(); };
  const meals = planRestMeals({ party, inventory, companions });

  useEffect(() => {
    if (isOpen) {
      setChoices({});
      setError(null);
      setHoursToWait(1);
      setMinutesToWait(0);
    }
  }, [isOpen]);

  const updateChoice = (charId: string, choiceId: string, data: Partial<RacialRestChoiceData>) => {
    setChoices(prev => {
      const charChoices = prev[charId] || {};
      const currentChoice = charChoices[choiceId] || {};
      return {
        ...prev,
        [charId]: {
          ...charChoices,
          [choiceId]: { ...currentChoice, ...data }
        }
      };
    });
  };

  const handleConfirm = async () => {
    if (pending.current || waitHours > 0 || noEligibleMembers || locationError) return;
    pending.current = true;
    setIsResting(true);
    setError(null);
    try {
      // Keep the confirmation mounted until overnight simulation finishes, so
      // another click cannot start a second rest using the same old state.
      await onConfirm(choices);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The rest could not finish.');
    } finally {
      pending.current = false;
      setIsResting(false);
    }
  };

  const handleWait = async (hours = hoursToWait, minutes = minutesToWait) => {
    const seconds = ordinaryWaitSeconds(hours, minutes);
    if (pending.current || !onWait || waitLocationError || seconds <= 0) return;
    pending.current = true;
    setIsResting(true);
    setIsWaiting(true);
    setError(null);
    try {
      // Waiting uses the normal world-time action and grants no rest benefits.
      // The player must still choose to start the rest after becoming eligible.
      await onWait(seconds);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Waiting could not finish.');
    } finally {
      pending.current = false;
      setIsWaiting(false);
      setIsResting(false);
    }
  };

  const charactersNeedingChoice = party.filter(c =>
    c.race?.restChoices && c.race.restChoices.length > 0
  );

  // Keep the emergency close affordance separate from the footer's ordinary
  // Cancel action. The large square target matches Short Rest and remains easy
  // to reach on touch devices when the choice list makes the dialog tall.
  const header = (
    <div className="flex w-full items-center justify-between gap-4">
      <h2 className="text-xl font-bold text-amber-300">Long Rest</h2>
      <button
        type="button"
        onClick={close}
        aria-label="Cancel long rest"
        className={`${BTN_ICON} h-11 w-11 shrink-0 text-gray-400 hover:text-white`}
      >
        <span aria-hidden="true">x</span>
      </button>
    </div>
  );

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={close}
      ariaLabel="Long Rest"
      title={header}
      size="xl"
      id="long-rest"
      footer={
        <>
          <Button
            type="button"
            onClick={close}
            variant="ghost" className="min-h-11"
          >
            Cancel
          </Button>
          {onWait && <Button type="button" onClick={() => handleWait()} disabled={isResting || Boolean(waitLocationError) || waitSeconds <= 0}
            variant="secondary" className="min-h-11">
            {isWaiting ? 'Waiting…' : waitLabel}
          </Button>}
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isResting || waitHours > 0 || noEligibleMembers || Boolean(locationError)}
            variant="primary" className="min-h-11"
          >
            {isResting ? (isWaiting ? "Waiting…" : "Resting…") : "Confirm Long Rest"}
          </Button>
        </>
      }
    >
        <div className="mb-4 text-sm text-gray-300">
          {lodgingName && <p className="mb-2 text-amber-200">Reserved guest bed at {lodgingName}. Completing this rest uses the paid night; no additional room fee is charged.</p>}
          A long rest takes 8 hours at your current location. Eligible members recover Hit Points,
          Spell Slots and rest-based abilities. {getRulesEdition({rulesEdition}) === '2024'
            ? 'All spent Hit Point Dice return, and exhaustion decreases by one level.'
            : 'Up to half your total Hit Point Dice return (at least one); exhaustion decreases by one level for members who eat.'}
          <p className="mt-2">{meals.summary}</p>
          <p className="mt-2">Members at 0 HP gain no benefits. Planar restrictions may also limit recovery.</p>
          {party.filter(member => member.spellbook?.preparationPlan).map(member => {
            const edition = getRulesEdition({rulesEdition});
            const plan = member.spellbook!.preparationPlan!;
            const planError = preparationPlanError(member, plan, edition);
            const minutes = preparationMinutes(member, edition);
            return <p key={member.id} className="mt-2 text-amber-200">{member.name}: {planError
              ? 'The spell plan is incomplete or no longer eligible; current spells and the plan will be retained.'
              : 'Planned spells replace the active list only if this member benefits from the rest.'}
              {!planError && minutes > 0 && ' Prayer or study adds ' + minutes + ' minutes after the eight-hour rest. Party members prepare at the same time; only the longest eligible preparation adds to world time.'}</p>;
          })}
          {onWait && <p className="mt-2">Waiting advances the world at your current location without consuming rest provisions or granting recovery.</p>}
          {onWait && <div className="mt-2 flex flex-wrap items-center gap-2">
            <label>Hours to wait <input aria-label="Hours to wait" type="number" min={0} max={24} step={1} value={hoursToWait}
              disabled={isResting} onChange={event => {
                const hours = Math.max(0, Math.min(24, Math.floor(Number(event.target.value) || 0)));
                setHoursToWait(hours);
                if (hours === 24) setMinutesToWait(0);
              }}
              className="ml-2 min-h-11 w-20 rounded border border-slate-500 bg-slate-800 p-2 text-white" /></label>
            <label>Minutes to wait <input aria-label="Minutes to wait" type="number" min={0} max={59} step={1} value={minutesToWait}
              disabled={isResting || hoursToWait >= 24} onChange={event => setMinutesToWait(Math.max(0, Math.min(59, Math.floor(Number(event.target.value) || 0))))}
              className="ml-2 min-h-11 w-20 rounded border border-slate-500 bg-slate-800 p-2 text-white" /></label>
            {waitSeconds === 0 && <span className="text-amber-200">Choose at least one minute to wait.</span>}
            {waitHours > 1 && <Button type="button" disabled={isResting || Boolean(waitLocationError)} onClick={() => handleWait(waitHours, 0)}
              variant="secondary" className="min-h-11">Wait until rest is eligible ({waitHours} hours)</Button>}
          </div>}
          {waitHours > 0 && <p role="status" className="mt-2 text-amber-200">Wait at least {waitHours} more hour(s) before another long rest.</p>}
          {noEligibleMembers && <p role="status" className="mt-2 text-amber-200">At least one party member must have 1 HP to rest.</p>}
          {isResting && <p role="status" className="mt-2 text-sky-200">{isWaiting ? "Time is passing at your current location; no recovery is applied." : "The party is resting. The world continues overnight."}</p>}
          {restWarning && <p className="mt-2 text-amber-200">{restWarning}</p>}
          {locationError && <p role="status" className="mt-2 text-amber-200">{locationError}</p>}
          {waitLocationError && waitLocationError !== locationError && <p role="status" className="mt-2 text-amber-200">{waitLocationError}</p>}
          {error && <p role="alert" className="mt-2 text-red-300">{error}</p>}
          {charactersNeedingChoice.length > 0 && (
             <div className="mt-2 text-amber-200">
               Some characters must make choices for their racial traits before resting.
             </div>
          )}
        </div>

        <div className="space-y-6">
          {charactersNeedingChoice.map((member) => {
            const charId = member.id;
            if (!charId) return null;

            return (
              <div key={charId} className="bg-gray-900/50 rounded p-4 border border-gray-700">
                <h3 className="font-semibold text-white mb-2">{member.name}'s Racial Traits</h3>
                {member.race.restChoices?.map((choice: any) => (
                  <div key={choice.id} className="mb-4 last:mb-0">
                    <p className="text-sm text-gray-400 mb-2">{choice.traitName}</p>
                    {choice.options.map((opt: any, i: number) => (
                      <div key={i} className="mt-2">
                        <label className="block text-xs font-medium text-gray-400 mb-1 capitalize">
                          Select {opt.type} Proficiency
                        </label>
                        <select
                          className="min-h-11 w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200"
                          value={
                            (opt.type === 'skill' ? choices[charId]?.[choice.id]?.skillIds?.[0] : 
                             opt.type === 'tool' || opt.type === 'weapon' ? (choices[charId]?.[choice.id]?.toolIds?.[0] || choices[charId]?.[choice.id]?.weaponIds?.[0]) : 
                             choices[charId]?.[choice.id]?.season) || ""
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            if (opt.type === 'skill') updateChoice(charId, choice.id, { skillIds: [val] });
                            else if (opt.type === 'tool') updateChoice(charId, choice.id, { toolIds: [val] });
                            else if (opt.type === 'weapon') updateChoice(charId, choice.id, { weaponIds: [val] });
                            else if (opt.type === 'season') updateChoice(charId, choice.id, { season: val } as any);
                          }}
                        >
                          <option value="">-- Choose --</option>
                          {opt.type === 'skill' && (
                            <>
                              <option value="Acrobatics">Acrobatics</option>
                              <option value="Animal Handling">Animal Handling</option>
                              <option value="Arcana">Arcana</option>
                              <option value="Athletics">Athletics</option>
                              <option value="Deception">Deception</option>
                              <option value="History">History</option>
                              <option value="Insight">Insight</option>
                              <option value="Intimidation">Intimidation</option>
                              <option value="Investigation">Investigation</option>
                              <option value="Medicine">Medicine</option>
                              <option value="Nature">Nature</option>
                              <option value="Perception">Perception</option>
                              <option value="Performance">Performance</option>
                              <option value="Persuasion">Persuasion</option>
                              <option value="Religion">Religion</option>
                              <option value="Sleight of Hand">Sleight of Hand</option>
                              <option value="Stealth">Stealth</option>
                              <option value="Survival">Survival</option>
                            </>
                          )}
                          {(opt.type === 'tool' || opt.type === 'weapon') && (
                            <>
                              <optgroup label="Tools">
                                <option value="Thieves' Tools">Thieves' Tools</option>
                                <option value="Smith's Tools">Smith's Tools</option>
                                <option value="Tinker's Tools">Tinker's Tools</option>
                              </optgroup>
                              <optgroup label="Weapons">
                                <option value="Longsword">Longsword</option>
                                <option value="Shortsword">Shortsword</option>
                                <option value="Greatsword">Greatsword</option>
                                <option value="Rapier">Rapier</option>
                              </optgroup>
                            </>
                          )}
                          {opt.type === 'season' && (
                            <>
                              <option value="Autumn">Autumn</option>
                              <option value="Winter">Winter</option>
                              <option value="Spring">Spring</option>
                              <option value="Summer">Summer</option>
                            </>
                          )}
                        </select>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            );
          })}
          {charactersNeedingChoice.length === 0 && (
             <div className="text-gray-400 italic">No special choices are required for this rest.</div>
          )}
        </div>
    </ModalDialog>
  );
};

export default LongRestModal;
