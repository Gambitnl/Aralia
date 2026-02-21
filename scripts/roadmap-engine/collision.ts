import type { RoadmapNode } from './types';

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function relaxNodeCollisions(nodes: RoadmapNode[], minDistance = 160, iterations = 5) {
  const locked = new Set(['aralia_chronicles']);

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const aLocked = locked.has(a.id);
        const bLocked = locked.has(b.id);
        if (aLocked && bLocked) continue;

        let dx = b.initialX - a.initialX;
        let dy = b.initialY - a.initialY;
        let dist = Math.hypot(dx, dy);
        if (dist >= minDistance) continue;

        if (dist < 0.001) {
          const seed = hashString(`${a.id}|${b.id}`);
          const angle = (seed % 360) * (Math.PI / 180);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          dist = 1;
        }

        const ux = dx / dist;
        const uy = dy / dist;
        const overlap = minDistance - dist;

        const moveA = aLocked ? 0 : bLocked ? overlap : overlap / 2;
        const moveB = bLocked ? 0 : aLocked ? overlap : overlap / 2;

        a.initialX -= ux * moveA;
        a.initialY -= uy * moveA;
        b.initialX += ux * moveB;
        b.initialY += uy * moveB;
      }
    }
  }

  for (const node of nodes) {
    node.initialX = Math.round(node.initialX);
    node.initialY = Math.round(node.initialY);
  }
}
