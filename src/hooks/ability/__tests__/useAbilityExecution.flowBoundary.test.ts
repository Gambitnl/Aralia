/** Pins promise, callback and live-ref ownership at the new effectful spell seam. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { UseAbilityExecutionProps } from '../abilityExecutionTypes';
import { useAbilityExecution } from '../useAbilityExecution';
import { runSpellExecutionFlow } from '../execution/spellExecutionFlow';
import { createMockCombatCharacter } from '../../../utils/core/factories';
import type { Spell } from '../../../types/spells';
import swordBurst from '@/data/spells/level-0/sword-burst.json';

vi.mock('../execution/spellExecutionFlow', () => ({ runSpellExecutionFlow: vi.fn() }));
const ref = <T,>(current: T) => ({ current });
const makeProps = (): UseAbilityExecutionProps => ({
  charactersRef: ref([createMockCombatCharacter()]), mapDataRef: ref(null),
  reactiveTriggersRef: ref(undefined), currentPlaneRef: ref(undefined),
  pocketedSummonsRef: ref(undefined), activeSpellHelpersRef: ref(undefined),
  activeSpellForcesRef: ref(undefined), activeSpellGuardiansRef: ref(undefined),
  activeAnimatedObjectsRef: ref(undefined), activeSpellStructuresRef: ref(undefined),
  activeExtradimensionalSpacesRef: ref(undefined), activeSpellEmanationsRef: ref(undefined),
  spellObjectImpactsRef: ref(undefined), spellObjectRepairsRef: ref(undefined),
  spellObjectAccessChangesRef: ref(undefined), activeFireEffectsRef: ref(undefined),
  activeTruePolymorphTransformationsRef: ref(undefined),
  onExecuteAction: vi.fn(() => true), onCharacterUpdate: vi.fn(),
  requestReaction: vi.fn(async () => null),
  processedPostDamageReactionEventIdsRef: ref(new Set<string>()), cancelTargeting: vi.fn()
});
beforeEach(() => vi.clearAllMocks());

describe('spell flow boundary', () => {
  it('returns the flow promise directly and passes original live refs and recursive callback', () => {
    const config = makeProps();
    const { result } = renderHook(() => useAbilityExecution(config));
    const caster = config.charactersRef.current[0];
    const liveRoster = [createMockCombatCharacter({ id: 'new-live-caster' })];
    config.charactersRef.current = liveRoster;
    const promise = Promise.resolve(true);
    vi.mocked(runSpellExecutionFlow).mockReturnValueOnce(promise);
    const spell = swordBurst as unknown as Spell;
    const returned = result.current.executeSpell(spell, caster, [caster], 0);
    expect(returned).toBe(promise);
    const [context, continueInput, ...args] = vi.mocked(runSpellExecutionFlow).mock.calls[0];
    expect(context.charactersRef).toBe(config.charactersRef);
    expect(context.charactersRef.current).toBe(liveRoster);
    expect(context.executeSpell).toBe(result.current.executeSpell);
    expect(continueInput).toBe(result.current.executeSpell);
    expect(args).toEqual([spell, caster, [caster], 0]);
    expect(config.onExecuteAction).not.toHaveBeenCalled();
  });

  it('keeps callback identity for unchanged dependencies and refreshes a changed prompt owner', () => {
    const config = makeProps();
    const { result, rerender } = renderHook(({ props }) => useAbilityExecution(props), { initialProps: { props: config } });
    const first = result.current.executeSpell;
    rerender({ props: config });
    expect(result.current.executeSpell).toBe(first);
    rerender({ props: { ...config, onRequestInput: vi.fn() } });
    expect(result.current.executeSpell).not.toBe(first);
  });
});
