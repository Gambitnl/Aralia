import { TownDirection } from '../../../types/town';
import { CharacterVisualConfig } from '../../CharacterAssetService';
export declare class PlayerPainter {
    private ctx;
    constructor(ctx: CanvasRenderingContext2D);
    drawPlayer(x: number, y: number, facing: TownDirection, isMoving: boolean, visuals?: CharacterVisualConfig, colors?: {
        skin: string;
        hair: string;
        clothing: string;
    }): Promise<void>;
    private drawLayeredCharacter;
    private drawCharacterSprite;
}
