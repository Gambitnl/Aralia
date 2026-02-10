// TODO(2026-01-15 Codex-CLI): Replace this shim with upstream three typings once available in this repo.
/*
declare module 'three' {
  export class Object3D { [key: string]: any; }
  export class BufferGeometry { [key: string]: any; }
  export class BufferAttribute { [key: string]: any; constructor(...args: any[]); }
  export class Texture { [key: string]: any; }
  export class TextureLoader { [key: string]: any; constructor(...args: any[]); loadAsync(...args: any[]): Promise<Texture>; }
  export class Material { [key: string]: any; }
  export class LineBasicMaterial extends Material { [key: string]: any; constructor(...args: any[]); }
  export class MeshBasicMaterial extends Material { [key: string]: any; constructor(...args: any[]); }
  export class MeshStandardMaterial extends Material { [key: string]: any; constructor(...args: any[]); }
  export class Mesh extends Object3D { [key: string]: any; }
  export class InstancedMesh extends Mesh { [key: string]: any; constructor(geometry: BufferGeometry, material: Material, count: number); }
  export class LineSegments extends Object3D { [key: string]: any; }
  export class SphereGeometry extends BufferGeometry { [key: string]: any; constructor(...args: any[]); }
  export class BoxGeometry extends BufferGeometry { [key: string]: any; constructor(...args: any[]); }
  export class PlaneGeometry extends BufferGeometry { [key: string]: any; constructor(...args: any[]); }
  export class DodecahedronGeometry extends BufferGeometry { [key: string]: any; constructor(...args: any[]); }
  export class Matrix4 { [key: string]: any; constructor(...args: any[]); }
  export class Color { [key: string]: any; constructor(...args: any[]); }
  export class Vector3 { [key: string]: any; constructor(...args: any[]); }
  export const RepeatWrapping: any;
  export const SRGBColorSpace: any;
  export const DoubleSide: any;
}
*/

declare module 'three/examples/jsm/controls/OrbitControls.js' {
  export class OrbitControls { [key: string]: any; constructor(...args: any[]); }
}

declare module 'three/examples/jsm/objects/Sky.js' {
  export class Sky { [key: string]: any; constructor(...args: any[]); }
}

declare module 'three/examples/jsm/loaders/GLTFLoader.js' {
  export class GLTFLoader { [key: string]: any; constructor(...args: any[]); loadAsync(...args: any[]): Promise<any>; }
}

declare module 'three/examples/jsm/loaders/DRACOLoader.js' {
  export class DRACOLoader { [key: string]: any; constructor(...args: any[]); setDecoderPath(...args: any[]): void; dispose(): void; }
}
