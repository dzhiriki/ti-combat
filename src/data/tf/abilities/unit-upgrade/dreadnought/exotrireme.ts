import sardakkNorrIcon from '@/assets/faction/sardakk_norr.svg?raw'
import { type Ability, type AbilityInvoke, declareParam } from '@/combat'
import { UNIT_LIMITS } from '@/constants/units'
import type { UnitList } from '@/types'

import { createTfUnitUpgrade } from '../create-tf-unit-upgrade'

// After a round of space combat, destroy 1 of your dreadnoughts to destroy up
// to 2 of the opponent's ships (picked by target priority). Opt-in via the
// card's `uses` counter — 0 by default, one use per sacrifice. All affordable
// sacrifices resolve after the same round (one per dreadnought), matching the
// Sardakk N'orr Exotrireme II. `sacrificePriority` has no UI item (the card
// upgrades every dreadnought, so there's only one option) — it exists so
// reconcile keeps the sacrifice lookup synced with dreadnought variants.
const exotriremeParams = {
  uses: 0,
  sacrificePriority: declareParam({
    default: [] as UnitList<boolean>,
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
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const exotriremeSelfDestructInvoke: AbilityInvoke<any> = {
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
    const usesLeft = typeof params.uses === 'number' ? params.uses : Infinity
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
}

const exotriremeUiConfig: Ability['uiConfig'] = ctx => [
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
]

export const exotrireme: Ability = createTfUnitUpgrade({
  key: 'TF_UPGRADE_EXOTRIREME',
  icon: sardakkNorrIcon,
  name: 'Exotrireme',
  description:
    "This unit cannot be destroyed by 'Spark' action cards. After a round of space combat, you may destroy this unit to destroy up to 2 ships in this system.",
  unitType: 'DREADNOUGHT',
  cost: 4,
  combat: [4, 1],
  move: 2,
  capacity: 1,
  sustain: true,
  bombardment: [4, 2],
  directHitImmune: true,
  extraParams: exotriremeParams,
  uiConfig: exotriremeUiConfig,
  invokes: [exotriremeSelfDestructInvoke],
})
