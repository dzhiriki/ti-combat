import { z } from 'zod/mini'

import { type Ability, declareParam } from '@/combat'
import { splitUnits } from '@/combat/abilities-engine/api/split-units'
import type { UnitList } from '@/types'
import { UnitListNumberSchema, UnitListSchema } from '@/types'

type Params = {
  customPriority: boolean
  unitPriority: UnitList
  disableSustainDamage: boolean
  units: UnitList<number>
}

declare global {
  interface AbilityConfigMap {
    BOMBARDMENT: Params
  }
}

export const bombardment: Ability<Params> = {
  key: 'BOMBARDMENT',
  name: 'Bombardment',
  description: 'Bombardment is resolved only when enabled',
  warning: 'Settings affect only normal Bombardment step',
  context: 'GROUND',
  paramsSchema: z.object({
    unitPriority: UnitListSchema,
    units: UnitListNumberSchema,
  }),
  params: {
    isEnabled: true,
    uses: Infinity,
    customPriority: false,
    unitPriority: declareParam<UnitList>({
      scope: 'type',
      default: [],
      source: 'GROUND_FORCES',
      side: 'opponent',
    }),
    disableSustainDamage: false,
    // Which planet each bombarding unit fires at; every unit bombards.
    units: declareParam<UnitList<number>>({
      scope: 'planet',
      default: [],
      defaultItemValue: 0,
      source: ['SHIPS', 'GROUND_FORCES'],
      sort: 'worth-desc',
      filter: {
        combatMode: 'GROUND',
        includeOnlyBaseTypes: true,
        includeNonParticipating: true,
      },
      split: { from: 'system', unitAbility: 'BOMBARDMENT' },
    }),
  },
  side: 'attacker',
  headerUI: 'isEnabled',
  uiConfig: ctx => [
    {
      key: 'units',
      type: 'unit-split',
      items: ctx.api.own.getUnitVariantsOptions('units'),
    },
    {
      key: 'disableSustainDamage',
      label: 'Disable Sustain Damage',
      type: 'checkbox',
    },
  ],
  invoke: [
    {
      timing: 'BOMBARDMENT_STEP',
      call: (ctx, params) => {
        const abilitiesOverride = params.disableSustainDamage
          ? { SUSTAIN_DAMAGE: false }
          : undefined
        const bombarding = ctx.api.own.system
          .getUnits()
          .filter(
            id => !!ctx.api.own.getUnitStats(id)?.UNIT_ABILITIES?.BOMBARDMENT,
          )
        // Resolutions run last-pushed first, so push the planets in reverse.
        for (const [planet, units] of splitUnits(
          ctx,
          params.units,
          bombarding,
        ).reverse())
          ctx.resolveStep('BOMBARDMENT', {
            abilitiesOverride,
            surfaceId: planet,
            units,
          })
      },
    },
  ],
}
