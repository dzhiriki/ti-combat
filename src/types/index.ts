export interface UnitSelection {
  count: number
  upgraded: boolean
}

export type CombatSide = 'attacker' | 'defender'

export type { DiceGroup } from './die'
export type {
  DataRegistry,
  Faction,
  FactionAbilities,
  FactionDefinition,
  FactionKey,
  GameSystem,
  Lazy,
} from './faction'
export type { GameData } from './game-data'
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
  UnitDefinitionInput,
  UnitId,
  UnitIdList,
  UnitList,
  UnitState,
  UnitStats,
  UnitStatsInput,
  UnitType,
  UnitVariantId,
} from './unit'
