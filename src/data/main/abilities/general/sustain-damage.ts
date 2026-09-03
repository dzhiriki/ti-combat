import { z } from 'zod/mini'

import { type Ability, declareParam } from '@/combat'
import type { UnitId, UnitList } from '@/types'
import { UnitListBooleanSchema } from '@/types'

type Params = {
  spacePriority: UnitList<boolean>
  groundPriority: UnitList<boolean>
}

declare global {
  /** Fires around a Sustain Damage use. Payload is the sustaining unit's id.
   *  `WHEN_` fires immediately; `AFTER_` fires right after. */
  interface TimingContextMap {
    WHEN_SUSTAIN_DAMAGE_USE: UnitId
    AFTER_SUSTAIN_DAMAGE_USE: UnitId
  }

  interface AbilityConfigMap {
    SUSTAIN_DAMAGE: Params
  }
}

export const sustainDamage: Ability<Params> = {
  key: 'SUSTAIN_DAMAGE',
  name: 'Sustain Damage',
  paramsSchema: z.object({
    spacePriority: UnitListBooleanSchema,
    groundPriority: UnitListBooleanSchema,
  }),
  params: {
    isEnabled: true,
    uses: Infinity,
    // Sourced from PARTICIPATING units (minus fighters) rather than
    // nonFighterShips so non-ship space combatants (Starlancer XI mechs)
    // appear in the panel and the allow-list. For every normal faction
    // spaceCombatParticipating === ships, so the list is identical to the
    // old nonFighterShips source.
    spacePriority: declareParam<UnitList<boolean>>({
      default: [],
      source: 'spaceCombatParticipating',
      defaultItemValue: true,
      filter: { exclude: ['FIGHTER'], combatMode: 'SPACE' },
    }),
    groundPriority: declareParam<UnitList<boolean>>({
      default: [],
      source: 'groundForces',
      defaultItemValue: true,
      filter: { combatMode: 'GROUND' },
    }),
  },
  sort: (params, ctx, unitIds) => {
    const isGround = ctx.state.combatMode === 'GROUND'
    const priority = isGround ? params.groundPriority : params.spacePriority

    const remaining = new Set(unitIds)
    const result: UnitId[] = []
    for (const variantId of ctx.utils.getFlat(priority)) {
      for (const id of ctx.api.own.getUnits(variantId, {
        includeVariants: false,
      })) {
        if (remaining.has(id)) {
          result.push(id)
          remaining.delete(id)
        }
      }
    }
    for (const id of unitIds) {
      if (remaining.has(id)) result.push(id)
    }
    return result
  },
  invoke: [
    {
      timing: 'BEFORE_ASSIGN_HITS',
      isCallable: (params, ctx) => {
        const unitId = ctx.getUnit()
        if (ctx.api.own.getPendingHits() <= 0) return false

        if (ctx.api.own.getUnitState(unitId)?.isDamaged) {
          return false
        }

        const unitType = ctx.api.own.getUnitBaseType(unitId)!
        const variantId = ctx.api.own.getUnitVariantKey(unitId)!

        const isGround = ctx.state.combatMode === 'GROUND'
        const allowedUnits = isGround
          ? params.groundPriority
          : params.spacePriority
        if (!ctx.utils.getFlat(allowedUnits).includes(variantId)) return false

        const validTargets = ctx.api.own.getHitPoolValidTargets()
        if (validTargets && !validTargets.includes(unitType)) {
          return false
        }

        if (
          ctx.api.own.isUnitAbilityLost('SUSTAIN_DAMAGE', unitType) ||
          ctx.api.own.isUnitAbilityCannotBeUsed('SUSTAIN_DAMAGE', unitType)
        ) {
          return false
        }

        return true
      },
      call: ctx => {
        const unitId = ctx.getUnit()
        ctx.api.own.modifyUnitState(unitId, { isDamaged: true })
        ctx.api.own.reduceHits(1)
        ctx.logger?.log(ctx.api.own.getUnitBaseType(unitId))
        // Triggered steps pop LIFO — push AFTER first so WHEN runs first.
        ctx.trigger('AFTER_SUSTAIN_DAMAGE_USE', unitId)
        ctx.trigger('WHEN_SUSTAIN_DAMAGE_USE', unitId)
      },
    },
  ],
  uiConfig: ctx => {
    const isGround = ctx.state.combatMode === 'GROUND'
    const key = isGround ? 'groundPriority' : 'spacePriority'

    return [
      {
        key,
        type: 'unit-list',
        mode: 'checkbox',
        sortable: true,
        items: ctx.api.own.getUnitVariantsOptions(key),
      },
    ]
  },
}
