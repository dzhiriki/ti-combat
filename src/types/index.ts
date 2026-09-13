export interface UnitSelection {
  count: number
  upgraded: boolean
}

export type { CombatSide } from './combat-side'
export type { DiceGroup } from './die'
export type {
  Faction,
  FactionAbilities,
  FactionDefinition,
  GameSystem,
  Lazy,
  LazyContext,
} from './faction'
export type {
  CollectedAbility,
  GameData,
  SlotCategory,
  SlotConfig,
  SlotEntry,
  SlotNames,
  SlotStrategy,
} from './game-data'
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
