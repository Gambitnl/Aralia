import { describe, expect, it, vi } from 'vitest';
import type { OllamaClient } from '../client';
import { generateBanterLine } from '../banter';

describe('player-directed Party Chat continuation', () => {
  it('uses the companion_banter profile and preserves committed player history for the NPC response', async () => {
    const priorHistory = [
      { speakerId: 'elara_vance', speakerName: 'Elara', text: 'I have been thinking about the old temple.' },
      { speakerId: 'player', speakerName: 'You', text: 'Why did you want to restore the temple?' },
    ];
    const participant = {
      id: 'elara_vance', name: 'Elara', race: 'Human', class: 'Cleric', sex: 'Female', age: 32,
      physicalDescription: 'Tall', personality: 'Compassionate', memories: [],
    };
    const client = {
      isAvailable: vi.fn().mockResolvedValue(true),
      resolveModel: vi.fn().mockResolvedValue('selected-banter-model'),
      chatForTask: vi.fn().mockResolvedValue({
        ok: true,
        model: 'selected-banter-model',
        data: { message: { content: JSON.stringify({ speakerId: 'elara_vance', text: 'I wanted the temple to shelter travellers.', emotion: 'warm', isConcluding: false }) } },
      }),
    } as unknown as OllamaClient;

    const result = await generateBanterLine(
      [participant],
      priorHistory,
      { locationName: 'Temple', weather: 'clear', timeOfDay: 'morning' } as never,
      2,
      undefined,
      client,
    );

    expect(result).toMatchObject({ success: true, data: { speakerId: 'elara_vance', text: 'I wanted the temple to shelter travellers.' } });
    expect(client.resolveModel).toHaveBeenCalledWith('companion_banter');
    expect(client.chatForTask).toHaveBeenCalledWith(expect.objectContaining({ taskType: 'companion_banter' }));
    const prompt = vi.mocked(client.chatForTask).mock.calls[0][0].messages[0].content;
    expect(prompt).toContain(priorHistory[0].text);
    expect(prompt).toContain(priorHistory[1].text);
  });
});
