import { describe, expect, it, vi } from 'vitest';
import { resolveDeEscalationIntent } from '../resolveDeEscalationIntent';

const CHAR_SKILLS = [
  { name: 'Stealth', ability: 'Dexterity' as const, proficient: true, modifier: 6 },
  { name: 'Persuasion', ability: 'Charisma' as const, proficient: false, modifier: 0 },
];

function stubClient(response: string) {
  return { generateForTask: vi.fn(async () => ({ ok: true as const, data: { response } })) };
}

describe('resolveDeEscalationIntent', () => {
  it('returns an attack intent', async () => {
    const client = stubClient(JSON.stringify({ kind: 'attack' }));
    const r = await resolveDeEscalationIntent('I draw my blade and strike', 'toll thugs', CHAR_SKILLS, { client: client as any });
    expect(r).toEqual({ kind: 'attack' });
  });

  it('maps a sneak sentence to a Stealth skill intent', async () => {
    const client = stubClient(JSON.stringify({ kind: 'skill', skill: 'Stealth', rationale: 'slips away' }));
    const r = await resolveDeEscalationIntent('I slip into the shadows', 'toll thugs', CHAR_SKILLS, { client: client as any });
    expect(r).toEqual({ kind: 'skill', skill: 'Stealth', ability: 'Dexterity', rationale: 'slips away' });
  });

  it('returns ambiguous with candidate skills', async () => {
    const client = stubClient(JSON.stringify({ kind: 'ambiguous', candidateSkills: ['Persuasion', 'Deception'] }));
    const r = await resolveDeEscalationIntent('I talk to them', 'toll thugs', CHAR_SKILLS, { client: client as any });
    expect(r).toEqual({ kind: 'ambiguous', candidateSkills: ['Persuasion', 'Deception'] });
  });

  it('throws honestly when the model is unreachable', async () => {
    const client = { generateForTask: vi.fn(async () => ({ ok: false as const, error: 'NO_MODEL' })) };
    await expect(resolveDeEscalationIntent('...', 't', CHAR_SKILLS, { client: client as any })).rejects.toThrow(/intent/i);
  });
});
