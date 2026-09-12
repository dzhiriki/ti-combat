import {
  UNIT_DISPLAY_NAMES,
  UNIT_SHORT_NAMES,
  UNIT_TYPES,
} from '@/constants/units'
import type { FactionKey, GameSystem, UnitBaseType } from '@/types'

import { getFactionUnitConfig } from './get-faction-unit-config'

export interface UnitConfig {
  name: string
  shortName: string
  hasUpgrade: boolean
}

export function getUnitConfig(
  system: GameSystem,
  factionKey: FactionKey,
): Record<UnitBaseType, UnitConfig> {
  const factionUnitConfig = getFactionUnitConfig(system, factionKey)
  const result = {} as Record<UnitBaseType, UnitConfig>

  for (const unitType of UNIT_TYPES) {
    const unitDef = factionUnitConfig[unitType]

    // Unit must have BOTH a BASE version AND an UPGRADED version to show upgrade button
    // Units with only UPGRADED (like War Sun with BASE: null) don't show upgrade button
    const hasBase = unitDef.BASE != null
    const hasUpgrade =
      hasBase &&
      unitDef.UPGRADED != null &&
      Object.keys(unitDef.UPGRADED).length > 0

    result[unitType] = {
      name: UNIT_DISPLAY_NAMES[unitType],
      shortName: UNIT_SHORT_NAMES[unitType],
      hasUpgrade,
    }
  }

  return result
}
