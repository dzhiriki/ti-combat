import type { UnitBaseType } from '@/types'

import type { MetaPhase } from '../combat-state/types'

export function getSettingsValidTargets(
  params: Record<string, unknown>,
  meta: MetaPhase,
): UnitBaseType[] {
  switch (meta) {
    case 'SPACE_CANNON_OFFENSE':
      return (params.validTargetsSpaceCannonOffense as UnitBaseType[]) ?? []
    case 'AFB':
      return (params.validTargetsAntiFighterBarrage as UnitBaseType[]) ?? []
    case 'BOMBARDMENT':
      return (params.validTargetsBombardment as UnitBaseType[]) ?? []
    case 'SPACE_CANNON_DEFENSE':
      return (params.validTargetsSpaceCannonDefense as UnitBaseType[]) ?? []
    default:
      return []
  }
}
