import type { AbilityInvoke } from '@/combat'
import type { UnitBaseType, UnitStats } from '@/types'

export type StatsInvoke = Extract<
  AbilityInvoke<unknown>,
  { timing: 'PREPARE' }
> & {
  readonly kind: 'stats'
  readonly unitType: UnitBaseType
  readonly stats: Readonly<UnitStats>
}

/** Apply a native stat block without consuming the ability's active uses.
 *  Keep the inputs on the invoke so copying abilities can read the printed
 *  upgrade stats rather than the unit's already-modified combat stats. */
export function createStatsInvoke(
  unitType: UnitBaseType,
  stats: Readonly<UnitStats>,
): StatsInvoke {
  return {
    kind: 'stats',
    unitType,
    stats,
    timing: 'PREPARE',
    system: true,
    call: ctx => {
      ctx.api.own.modifyUnitType(unitType, stats)
    },
  }
}
