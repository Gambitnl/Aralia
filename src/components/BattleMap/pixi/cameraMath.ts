// src/components/BattleMap/pixi/cameraMath.ts
/** Camera state for the Pixi board: x,y = world coordinate at the viewport's
 *  top-left corner; zoom = world→screen scale factor. Pure math only. */
export interface CameraView {
  x: number;
  y: number;
  zoom: number;
}

export const clampZoom = (z: number): number => Math.min(4, Math.max(0.15, z));

export const zoomAtCursor = (
  view: CameraView,
  factor: number,
  cursor: { x: number; y: number },
): CameraView => {
  const zoom = clampZoom(view.zoom * factor);
  // World point under the cursor must not move:
  //   view.x + cursor.x / view.zoom === next.x + cursor.x / zoom
  return {
    zoom,
    x: view.x + cursor.x / view.zoom - cursor.x / zoom,
    y: view.y + cursor.y / view.zoom - cursor.y / zoom,
  };
};

export const panBy = (view: CameraView, dx: number, dy: number): CameraView => ({
  ...view,
  x: view.x - dx / view.zoom,
  y: view.y - dy / view.zoom,
});

export const fitView = (
  mapPxW: number,
  mapPxH: number,
  viewportW: number,
  viewportH: number,
): CameraView => {
  const zoom = clampZoom(Math.min(viewportW / mapPxW, viewportH / mapPxH));
  return {
    zoom,
    x: (mapPxW - viewportW / zoom) / 2,
    y: (mapPxH - viewportH / zoom) / 2,
  };
};

/** Rasterization density for the ground plate at a given zoom: enough source
 *  pixels that the current zoom shows real detail, capped by a pixel budget
 *  (one plate for the prototype; chunking arrives with the full renderer). */
export const groundResolutionFor = (
  zoom: number,
  dpr: number,
  mapPxW: number,
  mapPxH: number,
): number => {
  const budget = Math.sqrt(48_000_000 / Math.max(1, mapPxW * mapPxH));
  return Math.max(1, Math.min(Math.max(dpr, 1) * Math.max(1, zoom) * 2, 4, budget));
};
