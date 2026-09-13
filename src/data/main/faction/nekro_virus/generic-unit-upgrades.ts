import type { Ability, AbilityCallContext } from '@/combat'
import { UNIT_TYPES } from '@/constants/units'
import type { UnitBaseType, UnitDefinition } from '@/types'
import { getEffectiveStats } from '@/utils/get-simulation-units'

export function createGenericUnitUpgrades(
  baseUnits: Readonly<Partial<Record<UnitBaseType, UnitDefinition>>>,
  conflictsByUnitType: Partial<Record<UnitBaseType, readonly string[]>>,
): Ability[] {
  const out: Ability[] = []
  for (const type of UNIT_TYPES) {
    const def = baseUnits[type]
    if (!def) continue
    const upgraded = def.UPGRADED
    if (!upgraded?.NAME) continue
    const effectiveStats = getEffectiveStats(def.BASE, upgraded, true)
    const conflicts = conflictsByUnitType[type] ?? []
    const key = `NEKRO_GENERIC_UPGRADE_${type}`
    out.push({
      key,
      name: upgraded.NAME,
      exclusiveGroup: type,
      params: { isEnabled: false, uses: Infinity },
      headerUI: 'isEnabled',
      invoke: [
        {
          timing: 'PREPARE',
          call: (ctx: AbilityCallContext) => {
            for (const conflictKey of conflicts) {
              const cfg = ctx.api.own.getAbilityConfig(
                conflictKey as Parameters<
                  typeof ctx.api.own.getAbilityConfig
                >[0],
              )
              if (cfg?.isEnabled) return
            }
            const original = { ...ctx.api.own.getUnitStats(type)! }
            ctx.api.own.updateAbilityConfig(key, {
              reset: () => (ctx2: AbilityCallContext) => {
                ctx2.api.own.modifyUnitType(type, original)
              },
            })
            ctx.api.own.modifyUnitType(type, effectiveStats)
          },
        },
      ],
    })
  }
  return out
}
