/** Camera state for the Pixi board: x,y = world coordinate at the viewport's
 *  top-left corner; zoom = world→screen scale factor. Pure math only. */
export interface CameraView {
    x: number;
    y: number;
    zoom: number;
}
export declare const clampZoom: (z: number) => number;
export declare const zoomAtCursor: (view: CameraView, factor: number, cursor: {
    x: number;
    y: number;
}) => CameraView;
export declare const panBy: (view: CameraView, dx: number, dy: number) => CameraView;
export declare const fitView: (mapPxW: number, mapPxH: number, viewportW: number, viewportH: number) => CameraView;
/** Rasterization density for the ground plate at a given zoom: enough source
 *  pixels that the current zoom shows real detail, capped by a pixel budget
 *  (one plate for the prototype; chunking arrives with the full renderer). */
export declare const groundResolutionFor: (zoom: number, dpr: number, mapPxW: number, mapPxH: number) => number;
