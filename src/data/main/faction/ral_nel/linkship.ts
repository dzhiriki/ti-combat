import { z } from 'zod/mini'

import { type Ability, declareParam } from '@/combat'
import type { SideApi } from '@/combat/abilities-engine/api/ability-api'
import type { DiceGroup, UnitBaseType, UnitList, UnitType } from '@/types'
import { UnitListNumberSchema } from '@/types'

type LinkshipIParams = {
  structures: UnitList<number>
}

type LinkshipIIParams = {
  structures: UnitList<number>
}

// Linkship I: each structure can only be triggered once
export const linkshipI: Ability<LinkshipIParams> = {
  key: 'LINKSHIP_1',
  name: 'Linkship I',
  description:
    'This unit can use the Space Cannon ability of one of your structures in its space area; each structure can only be triggered once.',
  context: 'SPACE',
  paramsSchema: z.object({
    structures: UnitListNumberSchema,
  }),
  params: {
    isEnabled: true,
    uses: Infinity,
    structures: declareParam<UnitList<number>>({
      default: [],
      source: 'structures',
      defaultItemValue: 0,
      filter: {
        include: ['PDS', 'SPACE_DOCK'] as UnitBaseType[],
        includeNonParticipating: true,
      },
      limit: 'EXTRA',
    }),
  },
  headerUI: 'isEnabled',
  uiConfig: ctx => [
    {
      key: 'structures',
      type: 'unit-list',
      mode: 'number',
      items: ctx.api.own.getUnitVariantsOptions('structures'),
    },
  ],
  invoke: [
    {
      // Which structures this Linkship pass has already spent lives in run
      // state — scoped to the single BEFORE_UNIT_ABILITY_ROLL pass and
      // discarded after, so it never leaks into state identity or the next
      // roll. Each linkship fires once and consumes its best free structure.
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: 'SPACE_CANNON_OFFENSE',
      isCallable: (params, ctx) =>
        availableStructures(params.structures, getConsumed(ctx.api.own)).some(
          ([, count]) => count > 0,
        ),
      call: (ctx, params) => {
        const best = findBestSpaceCannon(
          availableStructures(params.structures, getConsumed(ctx.api.own)),
          ctx.api.own,
        )
        if (!best) return

        ctx.api.own.addDiceGroup(best.sc)
        ctx.api.own.updateRunState({
          consumed: (prev?: UnitList<number>) => {
            const list = prev ?? []
            const next = list.map(([k, v]) =>
              k === best.key ? [k, v + 1] : [k, v],
            ) as UnitList<number>
            if (!list.some(([k]) => k === best.key)) {
              next.push([best.key as UnitType, 1])
            }
            return next
          },
        })
      },
    },
  ],
}

// Linkship II: each linkship can trigger the same structure
export const linkshipII: Ability<LinkshipIIParams> = {
  key: 'LINKSHIP_2',
  name: 'Linkship II',
  description:
    'This unit can use the Space Cannon ability of one of your structures in its space area; each linkship can trigger the same structure.',
  context: 'SPACE',
  paramsSchema: z.object({
    structures: UnitListNumberSchema,
  }),
  params: {
    isEnabled: true,
    uses: Infinity,
    structures: declareParam<UnitList<number>>({
      default: [],
      source: 'structures',
      defaultItemValue: 0,
      filter: {
        include: ['PDS', 'SPACE_DOCK'] as UnitBaseType[],
        includeNonParticipating: true,
      },
      limit: 'EXTRA',
    }),
  },
  headerUI: 'isEnabled',
  uiConfig: ctx => [
    {
      key: 'structures',
      type: 'unit-list',
      mode: 'number',
      items: ctx.api.own.getUnitVariantsOptions('structures'),
    },
  ],
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: 'SPACE_CANNON_OFFENSE',
      isCallable: (params, ctx) =>
        ctx.utils.getFlat(params.structures).length > 0,
      call: (ctx, params) => {
        const best = findBestSpaceCannon(params.structures, ctx.api.own)
        if (!best) return

        ctx.api.own.addDiceGroup(best.sc)
      },
    },
  ],
}

function expectedHits(sc: DiceGroup): number {
  return (sc[1] + (sc[2] ?? 0)) * (11 - sc[0])
}

function getConsumed(api: SideApi): UnitList<number> {
  return (
    (api.getRunState('LINKSHIP_1')?.consumed as UnitList<number> | undefined) ??
    []
  )
}

function availableStructures(
  structures: UnitList<number>,
  consumed: UnitList<number>,
): UnitList<number> {
  const consumedMap = new Map<string, number>()
  for (const [k, v] of consumed) consumedMap.set(k, v)
  return structures.map(([k, v]) => [
    k,
    Math.max(0, v - (consumedMap.get(k) ?? 0)),
  ]) as UnitList<number>
}

function findBestSpaceCannon(
  structures: UnitList<number>,
  api: SideApi,
): { key: string; sc: DiceGroup } | null {
  let best: { key: string; sc: DiceGroup } | null = null
  for (const [key, count] of structures) {
    if (count <= 0) continue
    const sc = api.getUnitStats(key as UnitType)?.UNIT_ABILITIES?.SPACE_CANNON
    if (sc && (!best || expectedHits(sc) > expectedHits(best.sc))) {
      best = { key, sc: [...sc] as DiceGroup }
    }
  }
  return best
}
