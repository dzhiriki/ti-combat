import { z } from 'zod/mini'

import lastBastionIcon from '@/assets/faction/last_bastion.svg?raw'
import { type Ability, declareParam } from '@/combat'
import {
  declareGalvanizeUnits,
  GALVANIZED,
  galvanizeUnit,
} from '@/data/main/abilities/general/pre-galvanized'
import type { UnitType } from '@/types'

type Params = {
  spaceUnitType: UnitType
  groundUnitType: UnitType
}

export const dameBriar: Ability<Params> = {
  key: 'DAME_BRIAR',
  name: 'Dame Briar',
  description:
    "When a player's unit is destroyed: You may exhaust this card to galvanize another of that player's units in the destroyed unit's system.",
  icon: lastBastionIcon,
  paramsSchema: z.object({
    spaceUnitType: z.string(),
    groundUnitType: z.string(),
  }),
  params: {
    isEnabled: false,
    uses: 1,
    spaceUnitType: declareParam<UnitType>({
      default: 'DESTROYER',
      source: 'spaceCombatParticipating',
      filter: { excludeSubtypes: [GALVANIZED], combatMode: 'SPACE' },
    }),
    groundUnitType: declareParam<UnitType>({
      default: 'INFANTRY',
      source: 'groundCombatParticipating',
      filter: { excludeSubtypes: [GALVANIZED], combatMode: 'GROUND' },
    }),
  },
  headerUI: 'isEnabled',
  declareSubtype: params => [
    declareGalvanizeUnits(params.spaceUnitType, true),
    declareGalvanizeUnits(params.groundUnitType, true),
  ],
  uiConfig: ctx => {
    const isGround = ctx.state.combatMode === 'GROUND'
    const key = isGround ? 'groundUnitType' : 'spaceUnitType'
    return [
      {
        key,
        label: 'Unit Type',
        type: 'select',
        items: ctx.api.own.getUnitVariantsOptions(key).reverse(),
      },
    ]
  },
  invoke: [
    {
      timing: 'WHEN_DESTROY',
      external: true,
      isCallable: (params, ctx, ids) => {
        const anyOwnDestroyed = ids.some(
          id => !!ctx.api.own.getUnitVariantKey(id),
        )
        if (!anyOwnDestroyed) return false
        const target =
          ctx.state.combatMode === 'GROUND'
            ? params.groundUnitType
            : params.spaceUnitType
        if (
          !ctx.api.own.surface.hasUnitType(target, { includeVariants: false })
        )
          return false
        const tokens =
          ctx.api.own.getAbilityConfig('PRE_GALVANIZED')?.reinforcementTokens ??
          0
        return tokens > 0
      },
      call: (ctx, params) => {
        const target =
          ctx.state.combatMode === 'GROUND'
            ? params.groundUnitType
            : params.spaceUnitType
        const ids = ctx.api.own.surface.getUnits(target, {
          includeVariants: true,
        })
        for (const id of ids) {
          if (galvanizeUnit(ctx, id, true)) break
        }
      },
    },
  ],
}
