import { z } from 'zod/mini'

import sardakkNorrIcon from '@/assets/faction/sardakk_norr.svg?raw'
import { type Ability, declareParam } from '@/combat'
import { foughtPlanetIds } from '@/combat/abilities-engine/unit-options'
import { parseUnitLocator } from '@/combat/utils/parse-unit-locator'
import type { UnitList } from '@/types'
import { UnitListNumberSchema } from '@/types'

type Params = {
  isEnabled: boolean
  units: UnitList<number>
}

export const ghomSekkus: Ability<Params> = {
  key: 'GHOM_SEKKUS',
  name: "G'hom Sek'kus",
  description:
    'You can commit up to 1 ground force from each planet in the active system and each planet in adjacent systems that do not contain 1 of your command tokens.',
  icon: sardakkNorrIcon,
  context: 'GROUND',
  side: 'attacker',
  paramsSchema: z.object({
    units: UnitListNumberSchema,
  }),
  params: {
    isEnabled: false,
    uses: Infinity,
    // Units to commit onto each invaded planet.
    units: declareParam<UnitList<number>>({
      scope: 'planet',
      default: [],
      source: 'GROUND_FORCES',
      sort: 'worth-desc',
      defaultItemValue: 0,
      filter: {
        combatMode: 'GROUND',
        include: ['MECH', 'INFANTRY'],
        includeNonParticipating: true,
      },
      limit: 'EXTRA',
    }),
  },
  headerUI: 'isEnabled',
  declareChanges: (ctx, params) => {
    // Earlier versions stored types without a planet: the first one.
    const [first] = foughtPlanetIds(ctx.state)
    for (const [key, count] of params.units) {
      const { unitType, surfaceId = first } = parseUnitLocator(key)
      if (count > 0) ctx.api.own.placeUnits({ [unitType]: count }, surfaceId)
    }
  },
  invoke: [
    {
      timing: 'COMMIT_UNITS',
      isCallable: (params, ctx) => ctx.utils.getFlat(params.units).length > 0,
      call: ctx => {
        ctx.invokeChanges()
      },
    },
  ],
  uiConfig: ctx => [
    {
      key: 'units',
      type: 'unit-list',
      mode: 'number',
      items: ctx.api.own.getUnitVariantsOptions('units'),
    },
  ],
}
