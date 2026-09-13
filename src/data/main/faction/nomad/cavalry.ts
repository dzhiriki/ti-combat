import { z } from 'zod/mini'

import nomadIcon from '@/assets/faction/nomad.svg?raw'
import { type Ability, declareParam, makeVariantId } from '@/combat'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import type { UnitType, UnitVariantId } from '@/types'
import { getEffectiveStats } from '@/utils/get-simulation-units'

import { nomad } from './index'

type Params = {
  memoria2: boolean
  unitType: UnitType
}

const CAVALRY = 'Cavalry' as UnitVariantId

export const cavalry: Ability<Params> = {
  key: 'CAVALRY',
  name: 'Cavalry',
  description:
    "At the start of a space combat against a player other than the Nomad: During this combat, treat 1 of your non-fighter ships as if it has the Sustain Damage ability, combat value, and Anti-Fighter Barrage value of the Nomad's flagship.",
  icon: nomadIcon,
  context: 'SPACE',
  paramsSchema: z.object({
    memoria2: z.boolean(),
    unitType: z.string(),
  }),
  params: {
    isEnabled: false,
    uses: 1,
    memoria2: false,
    unitType: declareParam<UnitType>({
      default: 'DESTROYER',
      source: 'nonFighterShips',
      filter: {
        excludeSubtypeSource: ['CAVALRY'],
        combatMode: 'SPACE',
      },
    }),
  },
  headerUI: 'isEnabled',
  declareSubtype: params => {
    const flagship = nomad.units.FLAGSHIP!
    const memoriaStats = getEffectiveStats(
      flagship.BASE,
      flagship.UPGRADED,
      params.memoria2,
    )
    return [
      {
        name: CAVALRY,
        unitType: params.unitType,
        participating: true,
        statsFactory: stats => {
          const hadSustain = stats.ABILITIES?.some(
            a => a.key === 'SUSTAIN_DAMAGE',
          )
          return {
            ...stats,
            COMBAT: [
              memoriaStats.COMBAT![0],
              memoriaStats.COMBAT![1],
              (memoriaStats.COMBAT![2] ?? 0) + (stats.COMBAT![2] ?? 0),
            ],
            UNIT_ABILITIES: {
              ...stats.UNIT_ABILITIES,
              SUSTAIN_DAMAGE: memoriaStats.UNIT_ABILITIES?.SUSTAIN_DAMAGE,
              AFB: memoriaStats.UNIT_ABILITIES?.AFB,
            },
            ABILITIES: hadSustain
              ? stats.ABILITIES
              : [...(stats.ABILITIES ?? []), sustainDamage],
          }
        },
      },
    ]
  },
  uiConfig: ctx => [
    {
      key: 'memoria2',
      label: 'Memoria II',
      type: 'checkbox',
    },
    {
      key: 'unitType',
      label: 'Unit Type',
      type: 'select',
      items: ctx.api.own.getUnitVariantsOptions('unitType').reverse(),
    },
  ],
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      isCallable: (params, ctx) => {
        return ctx.api.own.hasUnitType(params.unitType, {
          includeVariants: false,
        })
      },
      call: (ctx, params) => {
        const [unitId] = ctx.api.own.getUnits(params.unitType, {
          includeVariants: false,
        })

        if (unitId !== undefined) ctx.api.own.addSubtype(unitId, CAVALRY)
      },
    },
    {
      timing: 'CLEANUP',
      system: true,
      context: 'SPACE_COMBAT',
      call: (ctx, params) => {
        const variantId = makeVariantId(params.unitType, [CAVALRY])
        const [unitId] = ctx.api.own.getUnits(variantId, {
          includeVariants: false,
        })
        if (unitId !== undefined) ctx.api.own.removeSubtype(unitId, CAVALRY)
      },
    },
  ],
}
