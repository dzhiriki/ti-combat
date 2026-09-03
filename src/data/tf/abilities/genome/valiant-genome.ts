import { z } from 'zod/mini'

import {
  type Ability,
  type AbilityReadContext,
  type CombatMode,
  declareParam,
} from '@/combat'
import type { UnitId, UnitList } from '@/types'
import { UnitListBooleanSchema } from '@/types'

type Params = {
  spaceTriggers: UnitList<boolean>
  groundTriggers: UnitList<boolean>
  spaceTargets: UnitList<boolean>
  groundTargets: UnitList<boolean>
}

function modeKeys(mode: CombatMode) {
  return mode === 'GROUND'
    ? (['groundTriggers', 'groundTargets'] as const)
    : (['spaceTriggers', 'spaceTargets'] as const)
}

/** Variants of this side's units among the destroyed ids that are checked in
 *  `triggers`. */
function checkedDestroyed(
  ctx: AbilityReadContext,
  ids: UnitId[],
  triggers: string[],
): string[] {
  const out: string[] = []
  for (const id of ids) {
    const key = ctx.api.own.getUnitVariantKey(id)
    if (key && triggers.includes(key)) out.push(key)
  }
  return out
}

// Twilight's Fall genome. After one of your units is destroyed during combat,
// roll 1 die; if the result is ≥ that unit's combat value, your opponent must
// destroy 1 of their units. This is Courageous to the End with a single die
// and no space-only restriction, and it carries the same two settings: the
// trigger list picks which of your losses are worth the exhaust, and the
// target list gates on what the opponent would actually give up (they choose
// the casualty — don't spend the card if they'd chuck a fighter). When
// several of your checked units die together, the lowest combat value
// (easiest threshold) is used, as the player would choose.
export const valiantGenome: Ability<Params> = {
  key: 'TF_VALIANT_GENOME',
  name: 'Valiant Genome',
  description:
    "After one of your units is destroyed during combat: Roll 1 die. If the result is equal to or greater than that unit's combat value, your opponent must destroy 1 of their units.",
  paramsSchema: z.object({
    spaceTriggers: UnitListBooleanSchema,
    groundTriggers: UnitListBooleanSchema,
    spaceTargets: UnitListBooleanSchema,
    groundTargets: UnitListBooleanSchema,
  }),
  params: {
    isEnabled: false,
    uses: 1,
    spaceTriggers: declareParam<UnitList<boolean>>({
      default: [],
      source: 'spaceCombatParticipating',
      side: 'own',
      defaultItemValue: true,
      filter: { combatMode: 'SPACE' },
    }),
    groundTriggers: declareParam<UnitList<boolean>>({
      default: [],
      source: 'groundCombatParticipating',
      side: 'own',
      defaultItemValue: true,
      filter: { combatMode: 'GROUND' },
    }),
    spaceTargets: declareParam<UnitList<boolean>>({
      default: [],
      source: 'spaceCombatParticipating',
      side: 'opponent',
      defaultItemValue: true,
      filter: { combatMode: 'SPACE' },
    }),
    groundTargets: declareParam<UnitList<boolean>>({
      default: [],
      source: 'groundCombatParticipating',
      side: 'opponent',
      defaultItemValue: true,
      filter: { combatMode: 'GROUND' },
    }),
  },
  headerUI: 'isEnabled',
  uiConfig: ctx => {
    const [triggersKey, targetsKey] = modeKeys(ctx.state.combatMode)
    return [
      {
        key: triggersKey,
        label: 'Trigger on losing',
        type: 'unit-list',
        mode: 'checkbox',
        items: ctx.api.own.getUnitVariantsOptions(triggersKey),
      },
      {
        key: targetsKey,
        // A spend gate, not targeting: the opponent assigns the kill via
        // their own sacrifice order — this only governs whether the exhaust
        // is worth it.
        label: "Use only if they'd lose",
        type: 'unit-list',
        mode: 'checkbox',
        items: ctx.api.opponent.getUnitVariantsOptions(targetsKey),
      },
    ]
  },
  invoke: [
    {
      timing: 'AFTER_DESTROY',
      isCallable: (params, ctx, ids) => {
        const [triggersKey, targetsKey] = modeKeys(ctx.state.combatMode)
        const destroyed = checkedDestroyed(
          ctx,
          ids,
          ctx.utils.getFlat(params[triggersKey]),
        )
        if (destroyed.length === 0) return false

        const targets = ctx.api.opponent.getAssignHitsTargets(1)
        if (targets.length === 0) return false
        const targetEnabled = new Set<string>(
          ctx.utils.getFlat(params[targetsKey]),
        )
        return targets.every(targetId =>
          targetEnabled.has(ctx.api.opponent.getUnitVariantKey(targetId)!),
        )
      },
      call: (ctx, params, ids) => {
        const [triggersKey] = modeKeys(ctx.state.combatMode)
        const destroyed = checkedDestroyed(
          ctx,
          ids,
          ctx.utils.getFlat(params[triggersKey]),
        )
        let hitValue: number | undefined
        for (const key of destroyed) {
          const combat = ctx.api.own.getUnitStats(key)?.COMBAT?.[0]
          if (
            typeof combat === 'number' &&
            (hitValue === undefined || combat < hitValue)
          ) {
            hitValue = combat
          }
        }
        if (hitValue === undefined) return

        ctx.rollDice([[hitValue, 1]], (branchCtx, hits) => {
          if (hits[0] === 0) return
          const targets = branchCtx.api.opponent.getAssignHitsTargets(hits[0])
          branchCtx.api.opponent.destroyUnits(targets)
        })
      },
    },
  ],
}
