import { z } from 'zod/mini'

import {
  type Ability,
  type AbilityCallContext,
  type DeclaredSubtype,
  declareParam,
  parseVariantId,
} from '@/combat'
import { UNIT_TYPES } from '@/constants/units'
import type {
  UnitBaseType,
  UnitId,
  UnitList,
  UnitStats,
  UnitType,
  UnitVariantId,
} from '@/types'
import { UnitListNumberSchema } from '@/types'

type Params = {
  galvanizedUnits: UnitList<number, UnitBaseType>
  reinforcementTokens: number
}

declare global {
  /** Fires immediately after a unit becomes Galvanized. Payload is the newly
   *  galvanized UnitId. Declared here so only abilities that care (Last Bastion)
   *  participate — registered via global interface merging instead of being
   *  listed in the core `TimingContextMap`. */
  interface TimingContextMap {
    WHEN_GALVANIZE: UnitId
  }

  interface AbilityConfigMap {
    PRE_GALVANIZED: Params
  }
}

export const GALVANIZED = 'Galvanized' as UnitVariantId

export const preGalvanized: Ability<Params> = {
  key: 'PRE_GALVANIZED',
  name: 'Galvanized Units',
  paramsSchema: z.object({
    galvanizedUnits: UnitListNumberSchema,
    reinforcementTokens: z.number(),
  }),
  params: {
    isEnabled: true,
    uses: Infinity,
    galvanizedUnits: declareParam({
      default: [],
      defaultItemValue: 0,
      source: 'units',
      sort: 'normal-desc',
      filter: {
        includeOnlyBaseTypes: true,
        includeNonParticipating: true,
        includeOnlyAvailable: true,
      },
      limit: 'IN_COMBAT',
    }),
    reinforcementTokens: 7,
  },
  declareSubtype: params => {
    const counts = new Map(params.galvanizedUnits)
    return UNIT_TYPES.map(unitType =>
      declareGalvanizeUnits(unitType, (counts.get(unitType) ?? 0) > 0),
    )
  },
  uiConfig: ctx => [
    {
      key: 'reinforcementTokens',
      label: 'Tokens in reinforcement',
      type: 'number',
      min: 0,
    },
    {
      key: 'galvanizedUnits',
      type: 'unit-list',
      mode: 'number',
      items: ctx.api.own.getUnitVariantsOptions('galvanizedUnits'),
    },
  ],
  invoke: [
    {
      timing: 'PREPARE',
      call: (ctx, params) => {
        for (const [unitType, count] of params.galvanizedUnits) {
          if (count <= 0) continue
          const ids = ctx.api.own.getUnits(unitType, {
            includeVariants: false,
          })
          const max = Math.min(count, ids.length)
          for (let i = 0; i < max; i++) {
            galvanizeUnit(ctx, ids[i])
          }
        }
      },
    },
  ],
}

const bumpDice = <T extends [number, number] | [number, number, number]>(
  dice: T | undefined,
): T | undefined =>
  dice === undefined ? undefined : ([dice[0], dice[1], (dice[2] ?? 0) + 1] as T)

function galvanizeStats(stats: UnitStats): UnitStats {
  const combat = stats.COMBAT ? bumpDice(stats.COMBAT) : stats.COMBAT
  const abilities = stats.UNIT_ABILITIES
  const nextAbilities = abilities
    ? {
        ...abilities,
        BOMBARDMENT: bumpDice(abilities.BOMBARDMENT),
        AFB: bumpDice(abilities.AFB),
        SPACE_CANNON: bumpDice(abilities.SPACE_CANNON),
      }
    : abilities

  return { ...stats, COMBAT: combat, UNIT_ABILITIES: nextAbilities }
}

/** Galvanize the given unit — moves it to the Galvanized subtype with +1 bonus
 *  die on COMBAT, BOMBARDMENT, AFB, and SPACE_CANNON. Emits `WHEN_GALVANIZE`
 *  with the newly galvanized UnitId. Returns false if the unit is already
 *  galvanized, isn't tracked, or (when `consumeToken` is set) the
 *  PRE_GALVANIZED token pool is empty. */
export function galvanizeUnit(
  ctx: AbilityCallContext,
  unitId: UnitId,
  consumeToken?: boolean,
): boolean {
  const api = ctx.api.own
  const sourceKey = api.getUnitVariantKey(unitId)
  if (!sourceKey) return false
  if (parseVariantId(sourceKey).subtypes.includes(GALVANIZED)) return false
  if (consumeToken) {
    const tokens =
      api.getAbilityConfig('PRE_GALVANIZED')?.reinforcementTokens ?? 0
    if (tokens <= 0) return false
    api.updateAbilityConfig('PRE_GALVANIZED', {
      reinforcementTokens: tokens - 1,
    })
  }
  api.addSubtype(unitId, GALVANIZED)
  ctx.trigger('WHEN_GALVANIZE', unitId)
  return true
}

/** Declare a Galvanized subtype for a given unit type — for use inside an
 *  ability's `declareSubtype` so the Galvanized variant is registered with
 *  the right stats factory. `participating` controls whether the subtype is
 *  hidden by default (false) or surfaced everywhere (true). */
export function declareGalvanizeUnits(
  unitType: UnitType,
  participating: boolean,
): DeclaredSubtype {
  return {
    name: GALVANIZED,
    unitType,
    participating,
    statsFactory: galvanizeStats,
  }
}
