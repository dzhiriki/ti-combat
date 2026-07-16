export interface UnitSelection {
  count: number
  upgraded: boolean
}

export type CombatSide = 'attacker' | 'defender'

export type { DiceGroup } from './die'
export type { Faction, FactionKey, GameSystem } from './faction'
export {
  UnitListBooleanSchema,
  UnitListNumberSchema,
  UnitListSchema,
} from './schemas'
export type {
  Unit,
  UnitAbility,
  UnitBaseType,
  UnitDefinition,
  UnitId,
  UnitIdList,
  UnitList,
  UnitState,
  UnitStats,
  UnitType,
  UnitVariantId,
} from './unit'
