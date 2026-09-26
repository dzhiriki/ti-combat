import { z } from 'zod/mini'

import baronyOfLetnevIcon from '@/assets/faction/barony_of_letnev.svg?raw'
import { type Ability, declareParam } from '@/combat'
import { parseUnitLocator } from '@/combat/utils/parse-unit-locator'
import { locatorWithSubtype } from '@/combat/utils/unit-locator'
import { UnitLocatorSchema } from '@/types'
import type { DiceGroup, UnitLocator, UnitVariantId } from '@/types'

type Params = {
  unitType: UnitLocator
}

const VISCOUNT = 'Viscount' as UnitVariantId

export const viscountUnlenn: Ability<Params> = {
  key: 'VISCOUNT_UNLENN',
  name: 'Viscount Unlenn',
  description:
    'At the start of a space combat round: You may exhaust this card to choose 1 ship in the active system; that ship rolls 1 additional die during this combat round.',
  icon: baronyOfLetnevIcon,
  context: 'SPACE',
  paramsSchema: z.object({ unitType: UnitLocatorSchema }),
  params: {
    isEnabled: false,
    uses: 1,
    unitType: declareParam<UnitLocator>({
      default: 'FIGHTER',
      source: 'SHIPS',
      filter: {
        excludeSubtypeSource: ['VISCOUNT_UNLENN'],
        combatMode: 'SPACE',
      },
    }),
  },
  declareSubtype: params => {
    const { unitType, surfaceId } = parseUnitLocator(params.unitType)
    return [
      {
        name: VISCOUNT,
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
      items: ctx.api.own.getUnitVariantsOptions('unitType').reverse(),
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
        ctx.api.own.addSubtype(unitId, VISCOUNT)
      },
    },
    {
      timing: 'CLEANUP_ROUND',
      system: true,
      external: true,
      isCallable: (params, ctx) => {
        const variantId = locatorWithSubtype(params.unitType, VISCOUNT)
        return (
          ctx.api.own.participating.getUnits(variantId, {
            includeVariants: true,
          }).length > 0
        )
      },
      call: (ctx, params) => {
        const variantId = locatorWithSubtype(params.unitType, VISCOUNT)
        const [unitId] = ctx.api.own.participating.getUnits(variantId, {
          includeVariants: true,
        })
        ctx.api.own.removeSubtype(unitId, VISCOUNT)
      },
    },
  ],
}
