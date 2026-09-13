import type { RegisteredAbility } from '@/combat'
import type { CombatSide, GameSystem, UnitBaseType } from '@/types'
import { getGameData } from '@/utils/get-game-data'

/** @deprecated Prefer the corresponding method on `GameData`. */
export function getUnitDefinitionAbilityKeys(
  system: GameSystem,
  factionKey: string,
): ReadonlySet<string> {
  return getGameData(system).getUnitDefinitionAbilityKeys(factionKey)
}

/** @deprecated Prefer the corresponding method on `GameData`. */
export function getFactionOwnedAbilityKeys(
  system: GameSystem,
  factionKey: string,
): ReadonlySet<string> {
  return getGameData(system).getFactionOwnedAbilityKeys(factionKey)
}

/** @deprecated Prefer the corresponding method on `GameData`. */
export function getAvailableAbilities(
  system: GameSystem,
  side: CombatSide,
  factionKey: string,
  upgradedTypes?: ReadonlySet<UnitBaseType>,
): RegisteredAbility[] {
  return getGameData(system).getAvailableAbilities(
    side,
    factionKey,
    upgradedTypes,
  )
}
