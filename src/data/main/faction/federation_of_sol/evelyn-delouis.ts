import { z } from 'zod/mini'

import federationOfSolIcon from '@/assets/faction/federation_of_sol.svg?raw'
import { type Ability, declareParam, makeVariantId } from '@/combat'
import type { DiceGroup, UnitType, UnitVariantId } from '@/types'

type Params = {
  unitType: UnitType
}

const EVELYN = 'Evelyn' as UnitVariantId

export const evelynDelouis: Ability<Params> = {
  key: 'EVELYN_DELOUIS',
  name: 'Evelyn DeLouis',
  description:
    'At the start of a ground combat round: You may exhaust this card to choose 1 ground force in the active system; that ground force rolls 1 additional die during this combat round.',
  icon: federationOfSolIcon,
  context: 'GROUND',
  paramsSchema: z.object({ unitType: z.string() }),
  params: {
    isEnabled: false,
    uses: 1,
    unitType: declareParam<UnitType>({
      default: 'INFANTRY',
      source: 'groundForces',
      filter: {
        excludeSubtypeSource: ['EVELYN_DELOUIS'],
        combatMode: 'GROUND',
      },
    }),
  },
  declareSubtype: params => [
    {
      name: EVELYN,
      unitType: params.unitType,
      participating: true,
      statsFactory: parentStats => {
        if (!parentStats.COMBAT) return parentStats
        const [hit, dice, bonus = 0] = parentStats.COMBAT
        return { ...parentStats, COMBAT: [hit, dice, bonus + 1] as DiceGroup }
      },
    },
  ],
  headerUI: 'isEnabled',
  uiConfig: ctx => [
    {
      key: 'unitType',
      label: 'Unit Type',
      type: 'select',
      items: ctx.api.own.getUnitVariantsOptions('unitType').reverse(),
    },
  ],
  invoke: [
    {
      timing: 'START_OF_COMBAT_ROUND',
      external: true,
      isCallable: (params, ctx) => {
        return ctx.api.own.hasUnitType(params.unitType, {
          includeVariants: false,
        })
      },
      call: (ctx, params) => {
        const [unitId] = ctx.api.own.getUnits(params.unitType, {
          includeVariants: false,
        })
        ctx.api.own.addSubtype(unitId, EVELYN)
      },
    },
    {
      timing: 'CLEANUP_ROUND',
      system: true,
      external: true,
      isCallable: (params, ctx) => {
        const variantId = makeVariantId(params.unitType, [EVELYN])
        return (
          ctx.api.own.getUnits(variantId, { includeVariants: true }).length > 0
        )
      },
      call: (ctx, params) => {
        const variantId = makeVariantId(params.unitType, [EVELYN])
        const [unitId] = ctx.api.own.getUnits(variantId, {
          includeVariants: true,
        })
        ctx.api.own.removeSubtype(unitId, EVELYN)
      },
    },
  ],
}
