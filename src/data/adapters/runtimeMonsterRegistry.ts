import { MonsterData } from '../../types/ui';
import { MONSTERS_DATA } from '../monsters';

// Module-level cache, persists for the tab's lifetime.
// Pre-seeded from build-time ingested data; expanded at runtime by MonsterPicker.
const registry = new Map<string, MonsterData>(
  Object.entries(MONSTERS_DATA)
);

function toKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_');
}

export function getMonster(name: string): MonsterData | undefined {
  return registry.get(toKey(name));
}

export function registerMonster(data: MonsterData): void {
  registry.set(data.id, data);
}
