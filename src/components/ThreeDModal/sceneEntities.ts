export type SceneEntityKind = 'npc' | 'creature';

export interface SceneEntity {
  id: string;
  kind: SceneEntityKind;
  label: string;
  position: { x: number; z: number };
  /** How close the player must be to interact (in feet). */
  interactRadiusFt: number;
}

