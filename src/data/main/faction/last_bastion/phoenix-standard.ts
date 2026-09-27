import { z } from 'zod/mini'

import lastBastionIcon from '@/assets/faction/last_bastion.svg?raw'
import { type Ability, declareParam } from '@/combat'
import type { SideApi } from '@/combat/abilities-engine/api/ability-api'
import { parseUnitLocator } from '@/combat/utils/parse-unit-locator'
import {
  GALVANIZED,
  galvanizeUnit,
} from '@/data/main/abilities/general/pre-galvanized'
import type { UnitLocator } from '@/types'
import type { UnitList } from '@/types'
import { UnitListSchema } from '@/types'

type Params = {
  spaceUnitPriority: UnitList
  groundUnitPriority: UnitList
}

export const phoenixStandard: Ability<Params> = {
  key: 'PHOENIX_STANDARD',
  name: 'Phoenix Standard',
  description:
    'At the end of combat, you may galvanize 1 of your units that participated.',
  icon: lastBastionIcon,
  paramsSchema: z.object({
    spaceUnitPriority: UnitListSchema,
    groundUnitPriority: UnitListSchema,
  }),
  params: {
    isEnabled: false,
    uses: 1,
    spaceUnitPriority: declareParam({
      default: [],
      source: 'SHIPS',
      sort: 'worth-desc',
      filter: { includeOnlyBaseTypes: true, combatMode: 'SPACE' },
    }),
    groundUnitPriority: declareParam({
      default: [],
      source: 'GROUND_FORCES',
      sort: 'worth-desc',
      filter: { includeOnlyBaseTypes: true, combatMode: 'GROUND' },
    }),
  },
  headerUI: 'isEnabled',
  uiConfig: ctx => {
    const isGround = ctx.state.combatMode === 'GROUND'
    const key = isGround ? 'groundUnitPriority' : 'spaceUnitPriority'
    return [
      {
        key,
        label: 'Unit Priority',
        type: 'unit-list',
        mode: 'order',
        items: ctx.api.own.getUnitVariantsOptions(key),
      },
    ]
  },
  invoke: [
    {
      timing: 'END_OF_COMBAT',
      isCallable: (params, ctx) => {
        const priority =
          ctx.state.combatMode === 'GROUND'
            ? params.groundUnitPriority
            : params.spaceUnitPriority
        if (findTarget(ctx.api.own, priority) === undefined) return false
        const tokens =
          ctx.api.own.getAbilityConfig('PRE_GALVANIZED')?.reinforcementTokens ??
          0
        return tokens > 0
      },
      call: (ctx, params) => {
        const priority =
          ctx.state.combatMode === 'GROUND'
            ? params.groundUnitPriority
            : params.spaceUnitPriority
        const target = findTarget(ctx.api.own, priority)
        if (target === undefined) return
        const ids = ctx.api.own.participating.getUnits(target, {
          includeVariants: true,
        })
        for (const id of ids) {
          if (galvanizeUnit(ctx, id, true)) break
        }
      },
    },
  ],
}

function findTarget(api: SideApi, priority: UnitList): UnitLocator | undefined {
  for (const [t] of priority) {
    const type = t
    if (parseUnitLocator(type).subtypes.includes(GALVANIZED)) continue
    if (
      api.participating.hasUnitType(type, {
        includeVariants: true,
      })
    )
      return type
  }
  return undefined
}
