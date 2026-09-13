import { z } from 'zod/mini'

import lastBastionIcon from '@/assets/faction/last_bastion.svg?raw'
import { type Ability, declareParam, parseVariantId } from '@/combat'
import type { SideApi } from '@/combat/abilities-engine/api/ability-api'
import {
  GALVANIZED,
  galvanizeUnit,
} from '@/data/main/abilities/general/pre-galvanized'
import type { UnitBaseType, UnitList, UnitType } from '@/types'
import { UnitListSchema } from '@/types'

type Params = {
  spaceUnitPriority: UnitList<never, UnitBaseType>
  groundUnitPriority: UnitList<never, UnitBaseType>
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
      source: 'spaceCombatParticipating',
      sort: 'worth-desc',
      filter: { includeOnlyBaseTypes: true },
    }),
    groundUnitPriority: declareParam({
      default: [],
      source: 'groundCombatParticipating',
      sort: 'worth-desc',
      filter: { includeOnlyBaseTypes: true },
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
        const ids = ctx.api.own.getUnits(target, { includeVariants: true })
        for (const id of ids) {
          if (galvanizeUnit(ctx, id, true)) break
        }
      },
    },
  ],
}

function findTarget(api: SideApi, priority: UnitList): UnitType | undefined {
  for (const [t] of priority) {
    const type = t as UnitType
    if (parseVariantId(type).subtypes.includes(GALVANIZED)) continue
    if (api.hasUnitType(type, { includeVariants: true })) return type
  }
  return undefined
}
