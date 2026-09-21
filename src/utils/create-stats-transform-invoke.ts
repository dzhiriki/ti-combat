import type { AbilityInvoke } from '@/combat'
import type { UnitBaseType, UnitStats } from '@/types'

export type StatsTransformInvoke = Extract<
  AbilityInvoke<unknown>,
  { timing: 'PREPARE' }
> & {
  readonly kind: 'stats-transform'
  readonly unitType: UnitBaseType
  readonly transform: (stats: Readonly<UnitStats>) => Partial<UnitStats>
}

/** Share relative printed-stat upgrades between simulation and reference cards. */
export function createStatsTransformInvoke(
  unitType: UnitBaseType,
  transform: StatsTransformInvoke['transform'],
): StatsTransformInvoke {
  return {
    kind: 'stats-transform',
    unitType,
    transform,
    timing: 'PREPARE',
    system: true,
    call: ctx => {
      const stats = ctx.api.own.getUnitStats(unitType)
      if (stats) ctx.api.own.modifyUnitType(unitType, transform(stats))
    },
  }
}
