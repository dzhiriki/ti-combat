import { z } from 'zod/mini'

import federationOfSolIcon from '@/assets/faction/federation_of_sol.svg?raw'
import { type Ability, declareParam } from '@/combat'
import { parseUnitLocator } from '@/combat/utils/parse-unit-locator'
import { locatorWithSubtype } from '@/combat/utils/unit-locator'
import { UnitLocatorSchema } from '@/types'
import type { DiceGroup, UnitLocator, UnitVariantId } from '@/types'

type Params = {
  unitType: UnitLocator
}

const EVELYN = 'Evelyn' as UnitVariantId

export const evelynDelouis: Ability<Params> = {
  key: 'EVELYN_DELOUIS',
  name: 'Evelyn DeLouis',
  description:
    'At the start of a ground combat round: You may exhaust this card to choose 1 ground force in the active system; that ground force rolls 1 additional die during this combat round.',
  icon: federationOfSolIcon,
  context: 'GROUND',
  paramsSchema: z.object({ unitType: UnitLocatorSchema }),
  params: {
    isEnabled: false,
    uses: 1,
    unitType: declareParam<UnitLocator>({
      default: 'INFANTRY',
      source: 'GROUND_FORCES',
      sort: 'combat-desc',
      filter: {
        excludeSubtypeSource: ['EVELYN_DELOUIS'],
        combatMode: 'GROUND',
      },
    }),
  },
  declareSubtype: params => {
    const { unitType, surfaceId } = parseUnitLocator(params.unitType)
    return [
      {
        name: EVELYN,
        unitType,
        surfaces: surfaceId === undefined ? undefined : [surfaceId],
        participating: true,
        statsFactory: parentStats => {
          if (!parentStats.COMBAT) return parentStats
          const [hit, dice, bonus = 0] = parentStats.COMBAT
          return { ...parentStats, COMBAT: [hit, dice, bonus + 1] as DiceGroup }
        },
      },
    ]
  },
  headerUI: 'isEnabled',
  uiConfig: ctx => [
    {
      key: 'unitType',
      label: 'Unit Type',
      type: 'select',
      items: ctx.api.own.getUnitVariantsOptions('unitType'),
    },
  ],
  invoke: [
    {
      timing: 'START_OF_COMBAT_ROUND',
      external: true,
      isCallable: (params, ctx) => {
        return ctx.api.own.participating.hasUnitType(params.unitType)
      },
      call: (ctx, params) => {
        const [unitId] = ctx.api.own.participating.getUnits(params.unitType)
        ctx.api.own.addSubtype(unitId, EVELYN)
      },
    },
    {
      timing: 'CLEANUP_ROUND',
      system: true,
      external: true,
      isCallable: (params, ctx) => {
        const variantId = locatorWithSubtype(params.unitType, EVELYN)
        return (
          ctx.api.own.participating.getUnits(variantId, {
            includeVariants: true,
          }).length > 0
        )
      },
      call: (ctx, params) => {
        const variantId = locatorWithSubtype(params.unitType, EVELYN)
        const [unitId] = ctx.api.own.participating.getUnits(variantId, {
          includeVariants: true,
        })
        ctx.api.own.removeSubtype(unitId, EVELYN)
      },
    },
  ],
}
