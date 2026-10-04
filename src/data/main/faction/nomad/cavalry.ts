import { z } from 'zod/mini'

import nomadIcon from '@/assets/faction/nomad.svg?raw'
import { type Ability, declareParam } from '@/combat'
import { parseUnitLocator } from '@/combat/utils/parse-unit-locator'
import { locatorWithSubtype } from '@/combat/utils/unit-locator'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import { UnitLocatorSchema } from '@/types'
import type { UnitLocator, UnitVariantId } from '@/types'
import { getEffectiveStats } from '@/utils/get-simulation-units'

import { nomad } from './index'

type Params = {
  memoria2: boolean
  unitType: UnitLocator
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
    unitType: UnitLocatorSchema,
  }),
  params: {
    isEnabled: false,
    uses: 1,
    memoria2: false,
    unitType: declareParam<UnitLocator>({
      default: 'DESTROYER',
      source: 'SHIPS',
      sort: 'combat-asc',
      filter: {
        exclude: ['FIGHTER'],
        excludeSubtypeSource: ['CAVALRY'],
        combatMode: 'SPACE',
      },
    }),
  },
  headerUI: 'isEnabled',
  declareSubtype: params => {
    const { unitType, surfaceId } = parseUnitLocator(params.unitType)
    const flagship = nomad.units.FLAGSHIP!
    const memoriaStats = getEffectiveStats(
      flagship.BASE,
      flagship.UPGRADED,
      params.memoria2,
    )
    return [
      {
        name: CAVALRY,
        unitType,
        surfaces: surfaceId === undefined ? undefined : [surfaceId],
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
      items: ctx.api.own.getUnitVariantsOptions('unitType'),
    },
  ],
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      isCallable: (params, ctx) => {
        return ctx.api.own.participating.hasUnitType(params.unitType)
      },
      call: (ctx, params) => {
        const [unitId] = ctx.api.own.participating.getUnits(params.unitType)

        if (unitId !== undefined) ctx.api.own.addSubtype(unitId, CAVALRY)
      },
    },
    {
      timing: 'CLEANUP',
      system: true,
      context: 'SPACE_COMBAT',
      call: (ctx, params) => {
        const variantId = locatorWithSubtype(params.unitType, CAVALRY)
        const [unitId] = ctx.api.own.participating.getUnits(variantId)
        if (unitId !== undefined) ctx.api.own.removeSubtype(unitId, CAVALRY)
      },
    },
  ],
}
