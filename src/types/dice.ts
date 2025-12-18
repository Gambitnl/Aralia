export interface DiceRoll {
  dice: number;
  sides: number;
  type?: string; // Optional damage type
  modifier?: number;
}
