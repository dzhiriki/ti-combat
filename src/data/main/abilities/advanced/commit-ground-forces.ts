import { z } from 'zod/mini'

import { type Ability, declareParam } from '@/combat'
import { splitUnits } from '@/combat/abilities-engine/api/split-units'
import { SPACE_SURFACE_ID, type UnitList } from '@/types'
import { UnitListNumberSchema } from '@/types'

type Params = {
  units: UnitList<number>
}

declare global {
  interface AbilityConfigMap {
    COMMIT_GROUND_FORCES: Params
  }
}

export const commitGroundForces: Ability<Params> = {
  key: 'COMMIT_GROUND_FORCES',
  name: 'Commit Ground Forces',
  description:
    'Ground forces in space land on the invaded planets. Split them between planets or keep some in space.',
  context: 'GROUND',
  side: 'attacker',
  readOnly: true,
  paramsSchema: z.object({
    units: UnitListNumberSchema,
  }),
  params: {
    isEnabled: true,
    uses: Infinity,
    units: declareParam<UnitList<number>>({
      scope: 'planet',
      default: [],
      defaultItemValue: 0,
      source: 'GROUND_FORCES',
      sort: 'worth-desc',
      filter: { combatMode: 'GROUND', includeOnlyBaseTypes: true },
      split: { from: 'space', canStay: true },
    }),
  },
  uiConfig: ctx => [
    {
      key: 'units',
      type: 'unit-split',
      items: ctx.api.own.getUnitVariantsOptions('units'),
    },
  ],
  invoke: [
    {
      timing: 'COMMIT_UNITS_STEP',
      call: (ctx, params) => {
        // Units committed from elsewhere (G'hom Sek'kus) were just placed
        // and have the newest ids: the planets, listed before space, take
        // them first, so they never stay in space.
        const inSpace = ctx.api.own.system
          .getUnits()
          .filter(
            id =>
              ctx.api.own.getUnitSurface(id) === SPACE_SURFACE_ID &&
              ctx.api.own.isUnitCategory(id, 'GROUND_FORCES'),
          )
          .sort((a, b) => (a < b ? 1 : -1))
        for (const [planet, ids] of splitUnits(ctx, params.units, inSpace))
          ctx.api.own.moveUnits(ids, planet)
      },
    },
  ],
}
