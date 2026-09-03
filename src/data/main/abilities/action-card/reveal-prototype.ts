import { z } from 'zod/mini'

import { type Ability, type AbilityReadContext, declareParam } from '@/combat'
import type { UnitBaseType, UnitList, UnitStats } from '@/types'
import { UnitListBooleanSchema } from '@/types'
import { getFactionUnitConfig } from '@/utils/get-faction-unit-config'

type Params = {
  spacePriority: UnitList<boolean>
  groundPriority: UnitList<boolean>
}

export const revealPrototype: Ability<Params> = {
  key: 'REVEAL_PROTOTYPE',
  name: 'Reveal Prototype',
  description:
    'At the start of a combat: Spend 4 resources to research a unit upgrade technology of the same type as 1 of your units that is participating in this combat.',
  paramsSchema: z.object({
    spacePriority: UnitListBooleanSchema,
    groundPriority: UnitListBooleanSchema,
  }),
  params: {
    isEnabled: false,
    uses: 1,
    spacePriority: declareParam<UnitList<boolean>>({
      source: 'spaceCombatParticipating',
      defaultItemValue: false,
      default: [],
      filter: { includeOnlyBaseTypes: true, combatMode: 'SPACE' },
    }),
    groundPriority: declareParam<UnitList<boolean>>({
      source: 'groundCombatParticipating',
      defaultItemValue: false,
      default: [],
      filter: { includeOnlyBaseTypes: true, combatMode: 'GROUND' },
    }),
  },
  headerUI: 'isEnabled',
  uiConfig: ctx => {
    const isGround = ctx.state.combatMode === 'GROUND'
    const key = isGround ? 'groundPriority' : 'spacePriority'
    return [
      {
        key,
        type: 'unit-list',
        mode: 'checkbox',
        sortable: true,
        items: ctx.api.own.getUnitVariantsOptions(key),
      },
    ]
  },
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      isCallable: (params, ctx) => pickTarget(params, ctx) !== undefined,
      call: (ctx, params) => {
        const target = pickTarget(params, ctx)!
        const faction = getFactionUnitConfig(ctx.api.own.getFaction())
        const upgraded = faction[target].UPGRADED!
        const current = ctx.api.own.getUnitStats(target)!

        const delta: Partial<UnitStats> = { ...upgraded }
        if (upgraded.UNIT_ABILITIES) {
          delta.UNIT_ABILITIES = {
            ...current.UNIT_ABILITIES,
            ...upgraded.UNIT_ABILITIES,
          }
        }

        ctx.api.own.modifyUnitType(target, delta)
      },
    },
  ],
}

function isAlreadyUpgraded(
  upgradedDef: Partial<UnitStats>,
  current: UnitStats,
): boolean {
  for (const [key, upgradedValue] of Object.entries(upgradedDef)) {
    if (key === 'ABILITIES') continue
    if (key === 'UNIT_ABILITIES') {
      const entries = Object.entries(
        (upgradedValue ?? {}) as Record<string, unknown>,
      )
      for (const [abilKey, abilVal] of entries) {
        const currentAbil = (
          current.UNIT_ABILITIES as Record<string, unknown> | undefined
        )?.[abilKey]
        if (JSON.stringify(currentAbil) !== JSON.stringify(abilVal))
          return false
      }
    } else {
      const currentValue = (current as Record<string, unknown>)[key]
      if (JSON.stringify(currentValue) !== JSON.stringify(upgradedValue))
        return false
    }
  }
  return true
}

function pickTarget(
  params: Params,
  ctx: AbilityReadContext,
): UnitBaseType | undefined {
  const priority =
    ctx.state.combatMode === 'GROUND'
      ? params.groundPriority
      : params.spacePriority
  const faction = getFactionUnitConfig(ctx.api.own.getFaction())

  for (const variantKey of ctx.utils.getFlat(priority)) {
    const type = variantKey as UnitBaseType
    // includeVariants: true so a Cruiser already moved to a subtype variant
    // (e.g. by Viscount running first via ABILITY_ORDER) is still found.
    // modifyUnitType then upgrades the base entry; subtype factories
    // re-evaluate against it lazily.
    if (!ctx.api.own.hasUnitType(type, { includeVariants: true })) continue
    const upgraded = faction[type]?.UPGRADED
    if (!upgraded || Object.keys(upgraded).length === 0) continue
    const current = ctx.api.own.getUnitStats(type)
    if (!current) continue
    if (isAlreadyUpgraded(upgraded, current)) continue
    return type
  }
  return undefined
}
