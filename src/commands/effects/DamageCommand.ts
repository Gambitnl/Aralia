import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CombatState } from '@/types/combat'

export class DamageCommand extends BaseEffectCommand {
  execute(state: CombatState): CombatState {
    throw new Error('Method not implemented.')
  }
  get description(): string {
    return 'Damage Effect (Stub)'
  }
}
