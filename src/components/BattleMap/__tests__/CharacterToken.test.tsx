/**
 * These tests pin compact token-level defense and source-role posture.
 *
 * The goal is not to retest combat math. The badge row simply mirrors the
 * existing resistance, vulnerability, and immunity fields in a tiny overlay so
 * players do not have to open the inspector for every target check. The tests
 * keep that presentation slice visible. Opening monsters additionally expose
 * their authored group choreography without changing their combat mechanics;
 * the 3D follow-up remains a later parity pass.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CharacterToken from '../CharacterToken';
import type { CombatCharacter } from '../../../types/combat';
import {
  DEFAULT_CONDITION_VISUAL,
  resolveConditionVisual
} from '../../../utils/visuals/conditionPalette';

const buildCharacter = (overrides: Partial<CombatCharacter> = {}): CombatCharacter => ({
  id: 'token-1',
  name: 'Target',
  level: 3,
  class: { id: 'fighter', name: 'Fighter' } as CombatCharacter['class'],
  position: { x: 2, y: 1 },
  stats: {
    strength: 14,
    dexterity: 12,
    constitution: 14,
    intelligence: 8,
    wisdom: 10,
    charisma: 10,
    speed: 30,
    baseInitiative: 0,
    size: 'Medium'
  } as CombatCharacter['stats'],
  abilities: [],
  team: 'enemy',
  currentHP: 22,
  maxHP: 22,
  initiative: 10,
  statusEffects: [],
  actionEconomy: {
    action: { used: false, remaining: 1 },
    bonusAction: { used: false, remaining: 1 },
    reaction: { used: false, remaining: 1 },
    legendary: { used: 0, total: 0 },
    movement: { used: 0, total: 30 },
    freeActions: 0
  },
  ...overrides
});

describe('CharacterToken defense badges', () => {
  it('renders compact resistance, vulnerability, and immunity badges with tooltip summaries', () => {
    render(
      <CharacterToken
        character={buildCharacter({
          resistances: ['fire'],
          nonMagicalResistances: ['bludgeoning'],
          vulnerabilities: ['cold'],
          immunities: ['necrotic'],
          nonMagicalImmunities: ['piercing', 'slashing']
        })}
        position={{ x: 2, y: 1 }}
        isSelected={false}
        isTargetable={false}
        targetingMode={false}
        isTurn={false}
        onCharacterClick={() => undefined}
      />
    );

    const resistanceBadge = screen.getByTestId('defense-badge-resistance');
    const vulnerabilityBadge = screen.getByTestId('defense-badge-vulnerability');
    const immunityBadge = screen.getByTestId('defense-badge-immunity');

    // VIZ-3 (agora-75ed.3): the three badges are a disjoint LEFT COLUMN at
    // 0 / 11 / 22 px. They used to be `top-0` / `top-1/2` / `bottom-0` at 14 px
    // each on a 32 px token, so the ranges 0-14, 9-23 and 18-32 overlapped by
    // 5 px whenever a creature carried all three traits.
    expect(resistanceBadge).toHaveTextContent('R');
    expect(resistanceBadge).toHaveClass('left-0', 'top-0');
    expect(resistanceBadge).toHaveAttribute('aria-label', expect.stringContaining('Resistance: fire'));
    expect(resistanceBadge).toHaveAttribute('aria-label', expect.stringContaining('Non-magical resistance: bludgeoning'));

    expect(vulnerabilityBadge).toHaveTextContent('V');
    expect(vulnerabilityBadge).toHaveClass('left-0', 'top-[11px]');
    expect(vulnerabilityBadge).toHaveAttribute('aria-label', 'Vulnerability: cold');

    expect(immunityBadge).toHaveTextContent('I');
    expect(immunityBadge).toHaveClass('left-0', 'top-[22px]');
    expect(immunityBadge).toHaveAttribute('aria-label', expect.stringContaining('Immunity: necrotic'));
    expect(immunityBadge).toHaveAttribute('aria-label', expect.stringContaining('Non-magical immunity: piercing, slashing'));
  });

  it('keeps the token clear when a character has no damage traits to expose', () => {
    render(
      <CharacterToken
        character={buildCharacter()}
        position={{ x: 1, y: 1 }}
        isSelected={false}
        isTargetable={false}
        targetingMode={false}
        isTurn={false}
        onCharacterClick={() => undefined}
      />
    );

    expect(screen.queryByTestId('defense-badge-resistance')).not.toBeInTheDocument();
    expect(screen.queryByTestId('defense-badge-vulnerability')).not.toBeInTheDocument();
    expect(screen.queryByTestId('defense-badge-immunity')).not.toBeInTheDocument();
  });
});

describe('CharacterToken temporary HP cue', () => {
  it('shows the separate temporary-hit-point value without changing the normal HP token', () => {
    render(
      <CharacterToken
        character={buildCharacter({ currentHP: 12, maxHP: 24, tempHP: 8 })}
        position={{ x: 2, y: 1 }}
        isSelected={false}
        isTargetable={false}
        targetingMode={false}
        isTurn={false}
        onCharacterClick={() => undefined}
      />
    );

    expect(screen.getByTestId('temporary-hit-points-badge')).toHaveTextContent('+8');
    expect(screen.getByTestId('temporary-hit-points-badge')).toHaveAttribute(
      'aria-label',
      '8 temporary hit points',
    );
  });

  it('omits the temporary HP cue when no buffer exists', () => {
    render(
      <CharacterToken
        character={buildCharacter({ tempHP: 0 })}
        position={{ x: 2, y: 1 }}
        isSelected={false}
        isTargetable={false}
        targetingMode={false}
        isTurn={false}
        onCharacterClick={() => undefined}
      />
    );

    expect(screen.queryByTestId('temporary-hit-points-badge')).not.toBeInTheDocument();
  });
});

describe('CharacterToken status and concentration markers', () => {
  it('renders named status and concentration markers for spell effects', () => {
    render(
      <CharacterToken
        character={buildCharacter({
          statusEffects: [{
            id: 'enhance-ability-bear',
            name: 'Enhance Ability: Bear',
            type: 'buff',
            duration: 10,
            source: 'Enhance Ability'
          }],
          concentratingOn: {
            spellId: 'enhance-ability',
            spellName: 'Enhance Ability',
            spellLevel: 2,
            startedTurn: 3,
            effectIds: ['enhance-ability-bear'],
            canDropAsFreeAction: true
          }
        })}
        position={{ x: 2, y: 1 }}
        isSelected={false}
        isTargetable={false}
        targetingMode={false}
        isTurn={false}
        onCharacterClick={() => undefined}
      />
    );

    expect(screen.getByLabelText('Enhance Ability: Bear status marker')).toBeInTheDocument();
    expect(screen.getByLabelText('Concentrating on Enhance Ability')).toBeInTheDocument();
  });
});

/**
 * VIZ-3 (agora-75ed.3). Three failures observed on the live 2D board at
 * misc/design.html?step=battlemap&actorstatus=1 and captured under
 * .agent/scratch/agora-75ed.3/:
 *   1. every showcase actor reported `parts: []` — the token read only
 *      `statusEffects`, so a 5e `conditions[]` entry drew nothing;
 *   2. the 0 HP "Fallen Reaver" was pixel-identical to a healthy enemy;
 *   3. at the 0.15 minimum zoom a 4.8 px token was unfindable.
 * These tests pin the fixes without re-testing combat math.
 */
describe('CharacterToken VIZ-3 status parity and zoom detail', () => {
  const renderWith = (character: CombatCharacter, boardScale?: number) =>
    render(
      <CharacterToken
        character={character}
        position={{ x: 2, y: 1 }}
        isSelected={false}
        isTargetable={false}
        targetingMode={false}
        isTurn={false}
        onCharacterClick={() => undefined}
        boardScale={boardScale}
      />
    );

  it('surfaces a rules-level condition that carries no matching status effect', () => {
    renderWith(
      buildCharacter({
        statusEffects: [],
        conditions: [
          { name: 'Poisoned', duration: { type: 'permanent' }, appliedTurn: 0, source: 'test' }
        ] as CombatCharacter['conditions']
      })
    );

    expect(screen.getByLabelText('Poisoned status marker')).toBeInTheDocument();
    // The wash is the cue that survives every zoom level, so it must exist too.
    expect(screen.getByTestId('token-status-wash')).toHaveAttribute('data-token-status', 'condition');
  });

  /**
   * agora-f821.29. Every 2D condition marker used to render the same skull:
   * `conditions[]` entries carry no `icon`, so the synthetic StatusEffect the
   * token built fell through to the buff/debuff type switch. The markers now
   * come from the shared condition palette.
   */
  it('draws a DIFFERENT glyph for each condition instead of one shared skull', () => {
    renderWith(
      buildCharacter({
        statusEffects: [],
        conditions: [
          { name: 'Poisoned', duration: { type: 'permanent' }, appliedTurn: 0 },
          { name: 'Restrained', duration: { type: 'permanent' }, appliedTurn: 0 },
          { name: 'Blinded', duration: { type: 'permanent' }, appliedTurn: 0 }
        ] as CombatCharacter['conditions']
      })
    );

    const glyphs = ['Poisoned', 'Restrained', 'Blinded'].map(
      (name) => screen.getByTestId(`status-marker-${name}`).textContent
    );
    expect(new Set(glyphs).size).toBe(3);
    expect(glyphs).not.toContain('☠️');
    expect(glyphs).toEqual([
      resolveConditionVisual('Poisoned').icon,
      resolveConditionVisual('Restrained').icon,
      resolveConditionVisual('Blinded').icon
    ]);
  });

  it('rings each chip in its palette color, neutral where nothing is ruled', () => {
    renderWith(
      buildCharacter({
        statusEffects: [],
        conditions: [
          { name: 'Poisoned', duration: { type: 'permanent' }, appliedTurn: 0 },
          { name: 'Charmed', duration: { type: 'permanent' }, appliedTurn: 0 }
        ] as CombatCharacter['conditions']
      })
    );

    const rgb = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
    };

    // Poisoned is one of the six colors Remy ruled (Set C).
    expect(screen.getByTestId('status-marker-Poisoned').style.borderColor).toBe(
      rgb(resolveConditionVisual('Poisoned').chipColor)
    );
    // Charmed has no ruled color, so it sits on the one shared neutral.
    expect(screen.getByTestId('status-marker-Charmed').style.borderColor).toBe(
      rgb(DEFAULT_CONDITION_VISUAL.chipColor)
    );
  });

  it('caps the status row at three icons and collapses the rest into one chip', () => {
    renderWith(
      buildCharacter({
        statusEffects: ['Blessed', 'Hasted', 'Blinded', 'Slowed', 'Charmed'].map((name, index) => ({
          id: `effect-${index}`,
          name,
          type: 'buff' as const,
          duration: 3
        }))
      })
    );

    expect(screen.getAllByLabelText(/status marker$/)).toHaveLength(3);
    expect(screen.getByTestId('status-effect-overflow')).toHaveTextContent('+2');
  });

  it('marks a defeated combatant instead of drawing a zero-length health arc', () => {
    const { container } = renderWith(buildCharacter({ currentHP: 0, maxHP: 22 }));

    expect(screen.getByTestId('downed-token-marker')).toBeInTheDocument();
    expect(screen.getByTestId('token-status-wash')).toHaveAttribute('data-token-status', 'defeated');
    const disc = screen.getByTestId('token-disc');
    expect(disc.style.transform).toContain('scaleY(0.74)');
  });

  it('drops the perimeter badges and thickens the keyline once the board is shrunk', () => {
    const { container } = renderWith(
      buildCharacter({
        tempHP: 8,
        resistances: ['fire'],
        statusEffects: [{ id: 'e1', name: 'Blessed', type: 'buff', duration: 3 }]
      }),
      0.15
    );

    expect(screen.queryByTestId('temporary-hit-points-badge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('defense-badge-resistance')).not.toBeInTheDocument();
    expect(screen.queryByTestId('status-effect-row')).not.toBeInTheDocument();

    const disc = screen.getByTestId('token-disc');
    // 4 px band x the 3.2 cap, so the ring survives the board's CSS downscale.
    expect(disc.style.border).toContain('12.8px');
  });

  it('keeps every badge when no board scale is supplied', () => {
    renderWith(
      buildCharacter({
        tempHP: 8,
        resistances: ['fire'],
        statusEffects: [{ id: 'e1', name: 'Blessed', type: 'buff', duration: 3 }]
      })
    );

    expect(screen.getByTestId('temporary-hit-points-badge')).toBeInTheDocument();
    expect(screen.getByTestId('defense-badge-resistance')).toBeInTheDocument();
    expect(screen.getByTestId('status-effect-row')).toBeInTheDocument();
  });
});

describe('CharacterToken opening-scene choreography', () => {
  it('renders source-authored body geometry and carried equipment without a role ring', () => {
    render(
      <CharacterToken
        character={buildCharacter({
          id: 'opening-goblin-2',
          name: 'Goblin 2',
          worldSource: {
            kind: 'worldforge-opening-threat',
            sceneReceiptId: 'worldforge-opening-scene:test',
            sourceOpeningReceiptId: 'opening:42:cell:829',
            entityId: 'opening:goblin:2',
            monsterName: 'Goblin',
            monsterOrdinal: 2,
            socialRole: 'screen-left',
            worldGroundMeters: { x: 106, z: 197 },
            bodyState: {
              posture: 'crouched-left',
              carriedProfile: 'long-tool',
              facingDirection: { x: 1, z: 0 },
            },
          }
        })}
        position={{ x: 4, y: 3 }}
        isSelected={false}
        isTargetable={false}
        targetingMode={false}
        isTurn={false}
        onCharacterClick={() => undefined}
      />
    );

    expect(screen.getByTestId('opening-threat-body')).toHaveAttribute('data-opening-role', 'screen-left');
    expect(screen.getByTestId('opening-threat-body')).toHaveAttribute('data-body-posture', 'crouched-left');
    expect(screen.getByTestId('opening-threat-body')).toHaveAttribute('data-carried-profile', 'long-tool');
    expect(screen.getByTestId('opening-threat-body')).toHaveAttribute('data-facing-degrees', '90.0');
    expect(screen.getByTestId('opening-threat-carried-long-tool')).toBeInTheDocument();
    expect(screen.queryByTestId('opening-threat-role-ring')).not.toBeInTheDocument();
  });
});

describe('CharacterToken control-option poses (G7)', () => {
  const renderToken = (character: CombatCharacter) =>
    render(
      <CharacterToken
        character={character}
        position={{ x: 2, y: 1 }}
        isSelected={false}
        isTargetable={false}
        targetingMode={false}
        isTurn={false}
        onCharacterClick={() => undefined}
      />
    );

  const poseDisc = (container: HTMLElement) =>
    container.querySelector('[data-control-pose]') as HTMLElement | null;

  it('poses the token disc while a Command: Grovel status is active', () => {
    const { container } = renderToken(
      buildCharacter({
        statusEffects: [
          {
            id: 's1',
            name: 'Command: Grovel',
            type: 'debuff',
            duration: 1,
            description: 'grovels',
            effect: { type: 'skip_turn' }
          } as CombatCharacter['statusEffects'][number]
        ]
      })
    );

    const disc = poseDisc(container);
    expect(disc).not.toBeNull();
    expect(disc).toHaveAttribute('data-control-pose', 'grovel');
    // flattened, toppled transform composed after the base scale
    expect(disc!.style.transform).toContain('scale(1, 0.62)');
    expect(disc!.style.filter).toContain('brightness(0.8)');
  });

  it('restores the base look when no directive is active (fallback/restore)', () => {
    const { container } = renderToken(buildCharacter({ statusEffects: [] }));
    expect(poseDisc(container)).toBeNull();
  });
});
