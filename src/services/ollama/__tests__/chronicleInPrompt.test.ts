import { buildBanterPrompt } from '../banter';
import { buildContinuePrompt } from '../conversation';
import type { BanterContext, BanterParticipant, ConversationParticipant } from '../../../types/ollama';

const banterP: BanterParticipant = {
  id: 'c1', name: 'Ada', race: 'Human', class: 'Fighter', sex: 'female',
  age: 30, physicalDescription: 'tall', personality: 'gruff',
};
const convP: ConversationParticipant = { id: 'c1', name: 'Ada', personality: 'gruff' };

const chronicle = ['Year 3: Bedwyr died at age 81. Mara succeeded Bedwyr as innkeeper.'];

describe('town chronicle reaches the AI prompt', () => {
  it('buildBanterPrompt includes the town history lines when present', () => {
    const ctx: BanterContext = { locationName: 'Oakford', townChronicle: chronicle };
    const prompt = buildBanterPrompt([banterP], ctx);
    expect(prompt).toContain("recent history");
    expect(prompt).toContain('Bedwyr died');
  });

  it('buildBanterPrompt omits the history section when there is none', () => {
    const prompt = buildBanterPrompt([banterP], { locationName: 'Oakford' });
    expect(prompt).not.toContain("recent history");
  });

  it('buildContinuePrompt includes the town history lines when present', () => {
    const ctx: BanterContext = { locationName: 'Oakford', townChronicle: chronicle };
    const prompt = buildContinuePrompt([convP], [{ speakerId: 'player', text: 'hello' }], ctx, convP);
    expect(prompt).toContain("recent history");
    expect(prompt).toContain('Mara succeeded');
  });
});
