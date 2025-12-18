
import { describe, it, expect, beforeEach } from 'vitest';
import { EntityResolverService } from '../entityResolverService';

describe('EntityResolverService', () => {
  beforeEach(() => {
    EntityResolverService.resetRegistry();
  });

  it('extracts and registers titled entities from text', async () => {
    const text = "The party met Captain Vane.";

    const entities = await EntityResolverService.resolveEntitiesInText(text);

    expect(entities.length).toBe(1);
    const captain = entities.find(e => e.name === 'Captain Vane');
    expect(captain).toBeDefined();
    expect(captain?.type).toBe('npc');
  });

  it('extracts and registers suffixed locations from text', async () => {
    const text = "We arrived at Silverdale Village.";

    const entities = await EntityResolverService.resolveEntitiesInText(text);

    expect(entities.length).toBe(1);
    const silverdale = entities.find(e => e.name === 'Silverdale Village');
    expect(silverdale).toBeDefined();
    expect(silverdale?.type).toBe('location');
  });

  it('ignores ambiguous capitalized words', async () => {
    const text = "From the darkness he came. Then he left.";
    const entities = await EntityResolverService.resolveEntitiesInText(text);
    expect(entities.length).toBe(0);
  });

  it('deduplicates entities in the same session', async () => {
    const text1 = "We saw Captain Vane.";
    const text2 = "Captain Vane was there.";

    const [ent1] = await EntityResolverService.resolveEntitiesInText(text1);
    const [ent2] = await EntityResolverService.resolveEntitiesInText(text2);

    expect(ent1.id).toBe(ent2.id); // Same entity ID from registry
    expect(ent1).toBe(ent2); // Same object reference
  });
});
