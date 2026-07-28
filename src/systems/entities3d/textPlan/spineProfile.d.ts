export interface SpineProfileSpec {
  bodyRadM: number;
  spine: { taper: number; bulge?: number; mass?: [number, number, number] };
}
export declare function spineRadiusAt(spec: SpineProfileSpec, u: number): number;
