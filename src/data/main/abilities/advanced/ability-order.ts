import { z } from 'zod/mini'

import type { Ability } from '@/combat'
import { TIMING_GROUPS } from '@/combat/abilities-engine/abilities-engine'
import { UnitListSchema } from '@/types'

type Params = {
  startOfCombat: [string][]
  beforeDiceRoll: [string][]
  beforeUnitAbilityRoll: [string][]
  beforeAssignHits: [string][]
  endOfCombat: [string][]
  reroll: [string][]
}

export const abilityOrder: Ability<Params> = {
  key: 'ABILITY_ORDER',
  name: 'Resolve Order',
  paramsSchema: z.object({
    startOfCombat: UnitListSchema,
    beforeDiceRoll: UnitListSchema,
    beforeUnitAbilityRoll: UnitListSchema,
    beforeAssignHits: UnitListSchema,
    endOfCombat: UnitListSchema,
    reroll: UnitListSchema,
  }),
  params: {
    isEnabled: true,
    uses: Infinity,
    startOfCombat: [],
    beforeDiceRoll: [],
    beforeUnitAbilityRoll: [],
    beforeAssignHits: [],
    endOfCombat: [],
    reroll: [],
  },
  invoke: [],
  uiConfig: ctx => {
    return TIMING_GROUPS.map(group => {
      const abilities = ctx.getAbilitiesForTiming(group.timings)

      return {
        key: group.paramKey as keyof Params,
        label: group.label,
        type: 'unit-list',
        mode: 'order',
        items: abilities.map(a => ({ label: a.name, value: a.key })),
      }
    })
  },
}
