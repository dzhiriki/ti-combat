import { z } from 'zod/mini'

import sardakkNorrIcon from '@/assets/faction/sardakk_norr.svg?raw'
import { type Ability, declareParam } from '@/combat'
import { SPACE_SURFACE_ID, type UnitList, type UnitType } from '@/types'
import { UnitListNumberSchema } from '@/types'

type Params = {
  isEnabled: boolean
  units: UnitList<number, UnitType>
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
    units: declareParam<UnitList<number, UnitType>>({
      scope: 'type',
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
  // The units join the ones in space, and Commit Ground Forces lands them
  // on the planets by its split.
  declareChanges: (ctx, params) => {
    const toPlace: Partial<Record<UnitType, number>> = {}
    for (const [key, count] of params.units) {
      if (count > 0) toPlace[key] = count
    }
    ctx.api.own.placeUnits(toPlace, SPACE_SURFACE_ID)
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
