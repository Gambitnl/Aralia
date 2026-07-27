/**
 * This suite protects the procedural asset-forge registry and its seeded art contract.
 *
 * The design-preview page reads the registry to discover every showcase. These tests
 * confirm that the completed cave set remains registered, the dungeon set is reachable
 * with its authored canvas size, and drawing the same dungeon seed repeats exactly.
 * A lightweight recording canvas captures drawing instructions without requiring a
 * browser graphics backend.
 */

// ============================================================================
// Imports
// ============================================================================
// Vitest supplies assertions while the forge barrel exposes the same public
// registry and drawers consumed by the design-preview page.
// ============================================================================
import { describe, expect, it } from 'vitest';
import {
  ASSET_SETS,
  drawCaveSheet,
  drawDungeonSheet,
} from '../index';

// ============================================================================
// Recording Canvas
// ============================================================================
// Each canvas call and style assignment becomes a serializable event. Gradient
// color stops are recorded too, so seeded palette and geometry choices both
// participate in the determinism comparison.
// ============================================================================
interface DrawEvent {
  kind: 'call' | 'set';
  name: string;
  args: unknown[];
}

function createRecordingContext(): {
  ctx: CanvasRenderingContext2D;
  events: DrawEvent[];
} {
  const events: DrawEvent[] = [];
  const gradientNames = new WeakMap<object, string>();

  // Gradients need one real-looking method because the drawers add their color
  // stops after asking the canvas to create a gradient. The weak name table
  // replaces closure-bearing gradient objects with stable labels in style events.
  const recordingGradient = (name: string): CanvasGradient => {
    const gradient = {
      addColorStop: (offset: number, color: string) => {
        events.push({ kind: 'call', name: `${name}.addColorStop`, args: [offset, color] });
      },
    } as CanvasGradient;
    gradientNames.set(gradient, name);
    return gradient;
  };

  // Unknown canvas methods are harmless recorders. The forge uses gradients as
  // its only method return value, so those two calls receive dedicated objects.
  const ctx = new Proxy<Record<string, unknown>>({}, {
    get: (_target, property) => {
      const name = String(property);
      if (name === 'createLinearGradient' || name === 'createRadialGradient') {
        return (...args: unknown[]) => {
          events.push({ kind: 'call', name, args });
          return recordingGradient(name);
        };
      }
      return (...args: unknown[]) => {
        events.push({ kind: 'call', name, args });
      };
    },
    set: (_target, property, value) => {
      // Gradient instances contain a fresh callback on every render. Record
      // their semantic kind instead so the transcript compares drawing intent.
      const recordedValue = typeof value === 'object' && value !== null
        ? gradientNames.get(value as object) ?? value
        : value;
      events.push({ kind: 'set', name: String(property), args: [recordedValue] });
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;

  return { ctx, events };
}

function recordDungeon(seed: number): DrawEvent[] {
  const { ctx, events } = createRecordingContext();

  // Use the registry's authored dimensions so this proof exercises the exact
  // showcase contract that PreviewAssetForge consumes.
  const dungeon = ASSET_SETS.find((assetSet) => assetSet.id === 'dungeon');
  if (!dungeon) return events;
  dungeon.draw(ctx, dungeon.width, dungeon.height, seed);
  return events;
}

// ============================================================================
// Registry and Seed Contract
// ============================================================================
// These focused assertions guard discovery, preservation, and repeatability
// without snapshotting thousands of low-level canvas operations to disk.
// ============================================================================
describe('procedural asset forge registry', () => {
  it('keeps the completed cave set and exposes the dungeon showcase', () => {
    const cave = ASSET_SETS.find((assetSet) => assetSet.id === 'cave');
    const dungeon = ASSET_SETS.find((assetSet) => assetSet.id === 'dungeon');

    expect(cave?.draw).toBe(drawCaveSheet);
    expect(dungeon).toMatchObject({
      label: 'Dungeon',
      width: 1480,
      height: 1120,
      draw: drawDungeonSheet,
    });

    // Duplicate identifiers would make one showcase unreachable because the
    // preview selects the first matching registry entry.
    const ids = ASSET_SETS.map((assetSet) => assetSet.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('repeats every dungeon drawing instruction for the same seed', () => {
    const first = recordDungeon(201);
    const repeated = recordDungeon(201);
    const rerolled = recordDungeon(202);

    expect(first.length).toBeGreaterThan(1_000);
    expect(repeated).toEqual(first);
    expect(rerolled).not.toEqual(first);
  });
});
