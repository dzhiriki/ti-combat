import type { Ability, AbilityCallContext, AbilityReadContext } from '@/combat'
import type { UnitId } from '@/types'

export const emergencyRepairs: Ability = {
  key: 'EMERGENCY_REPAIRS',
  name: 'Emergency Repairs',
  description:
    'At the start or end of a combat round: Repair all of your units that have Sustain Damage in the active system.',
  params: { isEnabled: false, uses: 1 },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'START_OF_COMBAT_ROUND',
      isCallable,
      call,
    },
    {
      timing: 'END_OF_COMBAT_ROUND',
      isCallable,
      call,
    },
  ],
}

function getUnitsWithSustain(
  ctx: AbilityReadContext | AbilityCallContext,
): UnitId[] {
  const result: UnitId[] = []
  for (const type of ctx.api.own.getActiveBaseTypes()) {
    for (const unitId of ctx.api.own.getUnits(type, {
      includeVariants: true,
    })) {
      if (ctx.api.own.getUnitStats(unitId)?.UNIT_ABILITIES?.SUSTAIN_DAMAGE) {
        result.push(unitId)
      }
    }
  }
  return result
}

function isCallable(_params: unknown, ctx: AbilityReadContext): boolean {
  const sustainUnits = getUnitsWithSustain(ctx)
  if (sustainUnits.length === 0) return false
  return sustainUnits.every(id => ctx.api.own.getUnitState(id)?.isDamaged)
}

function call(ctx: AbilityCallContext): void {
  for (const id of getUnitsWithSustain(ctx)) {
    if (ctx.api.own.getUnitState(id)?.isDamaged) {
      ctx.api.own.modifyUnitState(id, { isDamaged: false })
    }
  }
}
