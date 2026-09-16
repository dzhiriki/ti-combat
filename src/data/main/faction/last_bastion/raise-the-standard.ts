import { z } from 'zod/mini'

import lastBastionIcon from '@/assets/faction/last_bastion.svg?raw'
import { type Ability, declareParam, parseVariantId } from '@/combat'
import type { SideApi } from '@/combat/abilities-engine/api/ability-api'
import {
  GALVANIZED,
  galvanizeUnit,
} from '@/data/main/abilities/general/pre-galvanized'
import type { UnitList, UnitType } from '@/types'
import { UnitListSchema } from '@/types'

type Params = {
  spaceUnitPriority: UnitList
  groundUnitPriority: UnitList
}

export const raiseTheStandard: Ability<Params> = {
  key: 'RAISE_THE_STANDARD',
  name: 'Raise the Standard',
  description:
    'At the end of a combat: Galvanize 1 of your units that participated. Then, return this card to the Last Bastion player.',
  icon: lastBastionIcon,
  paramsSchema: z.object({
    spaceUnitPriority: UnitListSchema,
    groundUnitPriority: UnitListSchema,
  }),
  params: {
    isEnabled: false,
    uses: 1,
    spaceUnitPriority: declareParam({
      default: [] as UnitList,
      source: 'spaceCombatParticipating',
      sort: 'worth-desc',
      filter: { includeOnlyBaseTypes: true },
    }),
    groundUnitPriority: declareParam({
      default: [] as UnitList,
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

function findTarget(api: SideApi, priority: UnitList): UnitType | undefined {
  for (const [t] of priority) {
    const type = t as UnitType
    if (parseVariantId(type).subtypes.includes(GALVANIZED)) continue
    if (
      api.participating.hasUnitType(type, {
        includeVariants: true,
      })
    )
      return type
  }
  return undefined
}
