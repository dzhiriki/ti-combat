import { z } from 'zod/mini'

import lastBastionIcon from '@/assets/faction/last_bastion.svg?raw'
import { type Ability, declareParam, makeVariantId } from '@/combat'
import { GALVANIZED } from '@/data/main/abilities/general/pre-galvanized'
import type { DiceGroup, UnitId, UnitType, UnitVariantId } from '@/types'

type Params = {
  heroUnit: UnitType | null
  heroDesignated: boolean
}

export const HERO = 'Hero' as UnitVariantId

export const apollo: Ability<Params> = {
  key: 'APOLLO',
  name: 'Entity 4X41A "Apollo"',
  description:
    "When one of your galvanized units is destroyed: You may purge this card to roll 1 die for each unit in its system that belongs to another player; if the result is equal to or greater than the galvanized unit's combat value, destroy that unit.",
  icon: lastBastionIcon,
  paramsSchema: z.object({
    heroUnit: z.string(),
    heroDesignated: z.boolean(),
  }),
  params: {
    isEnabled: false,
    uses: 1,
    heroUnit: declareParam<UnitType | null>({
      source: 'units',
      default: null,
      filter: { includeSubtypes: [GALVANIZED], excludeSubtypes: [HERO] },
    }),
    heroDesignated: false,
  },
  headerUI: 'isEnabled',
  declareSubtype: params =>
    params.heroUnit
      ? [
          {
            name: HERO,
            unitType: params.heroUnit,
            participating: true,
            statsFactory: parentStats => parentStats,
          },
        ]
      : [],
  uiConfig: ctx => [
    {
      key: 'heroUnit',
      label: 'Hero Unit',
      type: 'select',
      items: ctx.api.own.getUnitVariantsOptions('heroUnit'),
    },
  ],
  invoke: [
    {
      timing: 'WHEN_GALVANIZE',
      system: true,
      isCallable: (params, ctx, unitId) => {
        if (!params.heroUnit) return false
        // Hero is designated at most once per combat, even if the first Hero
        // has since been destroyed and Apollo has already fired.
        if (params.heroDesignated) return false
        return ctx.api.own.getUnitVariantKey(unitId) === params.heroUnit
      },
      call: (ctx, _params, unitId) => {
        ctx.api.own.addSubtype(unitId, HERO)
        ctx.api.own.updateAbilityConfig({ heroDesignated: true })
      },
    },
    {
      timing: 'WHEN_DESTROY',
      isCallable: (params, ctx, ids) => {
        if (!params.heroUnit) return false
        const heroVariant = makeVariantId(params.heroUnit, [HERO])
        return ids.some(id => ctx.api.own.getUnitVariantKey(id) === heroVariant)
      },
      call: (ctx, params) => {
        const heroVariant = makeVariantId(params.heroUnit!, [HERO])
        const hitValue = ctx.api.own.getUnitStats(heroVariant)?.COMBAT?.[0]
        if (hitValue === undefined) return

        // Group opponent units by (variant + full unit state) so mathematically
        // identical units share one dice group — avoids 2^N outcome explosion
        // on large stacks of identical units — while keeping units in any
        // distinct state as separate groups (each destruction leads to a
        // different post-Apollo state).
        const opp = ctx.api.opponent
        const groups = new Map<string, UnitId[]>()
        for (const baseType of opp.surface.getUnitTypes()) {
          for (const id of opp.surface.getUnits(baseType, {
            includeVariants: true,
          })) {
            const variantKey = opp.getUnitVariantKey(id) ?? baseType
            const state = opp.getUnitState(id) ?? {}
            const stateKey = Object.keys(state)
              .sort()
              .map(k => `${k}=${(state as Record<string, unknown>)[k]}`)
              .join(',')
            const groupKey = `${variantKey}|${stateKey}`
            const bucket = groups.get(groupKey)
            if (bucket) bucket.push(id)
            else groups.set(groupKey, [id])
          }
        }
        if (groups.size === 0) return

        const groupOrder: UnitId[][] = [...groups.values()]
        const dice: DiceGroup[] = groupOrder.map(ids => [hitValue, ids.length])

        ctx.rollDice(dice, (branchCtx, hits) => {
          const toDestroy: UnitId[] = []
          for (let i = 0; i < groupOrder.length; i++) {
            const n = Math.min(hits[i], groupOrder[i].length)
            for (let j = 0; j < n; j++) toDestroy.push(groupOrder[i][j])
          }
          if (toDestroy.length > 0)
            branchCtx.api.opponent.destroyUnits(toDestroy)
        })
      },
    },
    {
      timing: 'CLEANUP',
      context: 'SPACE_COMBAT',
      system: true,
      isCallable: params => !!params.heroUnit,
      call: (ctx, params) => {
        const variantId = makeVariantId(params.heroUnit!, [HERO])
        const [unitId] = ctx.api.own.surface.getUnits(variantId, {
          includeVariants: false,
        })
        ctx.api.own.removeSubtype(unitId, HERO)
      },
    },
  ],
}
