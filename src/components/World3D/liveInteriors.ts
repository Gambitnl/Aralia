/**
 * @file liveInteriors.ts
 * @description Which buildings have a live interior right now (GG-594).
 *
 * Only the walk-up buildings near the player mount their rooms
 * (SiteBuilding's `hasLiveInterior`). Every other building is a closed
 * shell. InteriorLights works from the chunk data, which holds the parts of
 * every building, so it cannot tell the two apart on its own. A sun-bounce
 * patch or a table lamp inside a closed shell lights nothing the player can
 * see, and the light still leaks through the shell onto the street.
 *
 * SiteBuilding adds its site object here while its rooms are mounted and
 * removes it on unmount. The key is the site object itself (the same object
 * InteriorLights reads from `chunk.bundle.sites`), so two chunks with equal
 * site ids never collide. A WeakSet keeps a dropped chunk from staying alive.
 */
const live = new WeakSet<object>();

export function markInteriorLive(site: object): () => void {
  live.add(site);
  return () => { live.delete(site); };
}

export function isInteriorLive(site: object): boolean {
  return live.has(site);
}
