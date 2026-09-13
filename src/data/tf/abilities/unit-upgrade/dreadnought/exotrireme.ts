import sardakkNorrIcon from '@/assets/faction/sardakk_norr.svg?raw'
import { type Ability, declareParam } from '@/combat'
import { UNIT_LIMITS } from '@/constants/units'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import type { UnitList } from '@/types'
import { createStatsInvoke } from '@/utils/create-stats-invoke'

type Params = {
  sacrificePriority: UnitList<boolean>
  targetPriority: UnitList<boolean>
}

// After a round of space combat, destroy 1 of your dreadnoughts to destroy up
// to 2 of the opponent's ships (picked by target priority). Opt-in via the
// card's `uses` counter — 0 by default, one use per sacrifice. All affordable
// sacrifices resolve after the same round (one per dreadnought), matching the
// Sardakk N'orr Exotrireme II. `sacrificePriority` has no UI item (the card
// upgrades every dreadnought, so there's only one option) — it exists so
// reconcile keeps the sacrifice lookup synced with dreadnought variants.
export const exotrireme: Ability<Params> = {
  key: 'TF_UPGRADE_EXOTRIREME',
  icon: sardakkNorrIcon,
  name: 'Exotrireme',
  description:
    "This unit cannot be destroyed by 'Spark' action cards. After a round of space combat, you may destroy this unit to destroy up to 2 ships in this system.",
  params: {
    isEnabled: false,
    uses: 0,
    sacrificePriority: declareParam<UnitList<boolean>>({
      default: [],
      source: 'ships',
      side: 'own',
      defaultItemValue: true,
      filter: { include: ['DREADNOUGHT'], combatMode: 'SPACE' },
    }),
    targetPriority: declareParam<UnitList<boolean>>({
      default: [],
      source: 'ships',
      side: 'opponent',
      sort: 'worth-desc',
      defaultItemValue: true,
      filter: { combatMode: 'SPACE' },
    }),
  },
  headerUI: 'isEnabled',
  exclusiveGroup: 'UNIT_UPGRADE_DREADNOUGHT',
  uiConfig: ctx => [
    {
      key: 'uses',
      label: 'Uses',
      type: 'number',
      min: 0,
      max: UNIT_LIMITS.DREADNOUGHT,
    },
    {
      key: 'targetPriority',
      label: 'Target Priority',
      type: 'unit-list',
      mode: 'checkbox',
      sortable: true,
      items: ctx.api.opponent.getUnitVariantsOptions('targetPriority'),
    },
  ],
  invoke: [
    createStatsInvoke('DREADNOUGHT', {
      COST: 4,
      COMBAT: [4, 1],
      MOVE: 2,
      CAPACITY: 1,
      UNIT_ABILITIES: { SUSTAIN_DAMAGE: true, BOMBARDMENT: [4, 2] },
      ABILITIES: [sustainDamage],
      DIRECT_HIT_IMMUNE: true,
    }),
    {
      timing: 'AFTER_COMBAT_ROUND',
      context: 'SPACE_COMBAT',
      isCallable: (params, ctx) =>
        ctx.api.own.findUnitByPriority(
          ctx.utils.getFlat(params.sacrificePriority),
          { includeVariants: false },
        ) !== undefined &&
        ctx.api.opponent.findUnitByPriority(
          ctx.utils.getFlat(params.targetPriority),
          { includeVariants: false },
        ) !== undefined,
      call: (ctx, params) => {
        // The engine bills one use for this invocation; further same-round
        // sacrifices are billed here via `updateAbilityConfig` (the engine's
        // decrement reads the updated value, so it isn't clobbered).
        const usesLeft = params.uses
        let spent = 0
        while (spent < usesLeft) {
          const sacrifice = ctx.api.own.findUnitByPriority(
            ctx.utils.getFlat(params.sacrificePriority),
            { includeVariants: false },
          )
          const targets = ctx.api.opponent.findUnitByPriority(
            ctx.utils.getFlat(params.targetPriority),
            { includeVariants: false, amount: 2 },
          )
          if (sacrifice === undefined || targets.length === 0) break
          ctx.api.opponent.destroyUnits(targets)
          ctx.api.own.destroyUnits(sacrifice)
          spent += 1
        }
        if (spent > 1 && isFinite(usesLeft)) {
          ctx.api.own.updateAbilityConfig({ uses: usesLeft - (spent - 1) })
        }
      },
    },
  ],
}
