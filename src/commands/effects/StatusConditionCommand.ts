import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CombatState } from '@/types/combat'

export class StatusConditionCommand extends BaseEffectCommand {
  execute(state: CombatState): CombatState {
    throw new Error('Method not implemented.')
  }
  get description(): string {
    return 'Status Condition Effect (Stub)'
  }
}
