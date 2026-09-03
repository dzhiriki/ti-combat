import { type Ability, type AbilityReadContext, declareParam } from '@/combat'
import type { UnitId, UnitList } from '@/types'

type Params = {
  spaceTargets: UnitList<boolean>
  groundTargets: UnitList<boolean>
}

/** The unit a one-hit cancel would actually save. `getAssignHitsTargets`
 *  returns the would-be victims in pool order — most-protected first, and
 *  the tail dies first — so with one hit cancelled the spared unit is the
 *  most-protected victim: index 0. */
function savedByHitCancel(ctx: AbilityReadContext): UnitId | undefined {
  const hits = ctx.api.own.getPendingHits()
  if (hits <= 0) return undefined
  const victims = ctx.api.own.getAssignHitsTargets(hits)
  return victims[0]
}

// Twilight's Fall action card. "When 1 of your units would be destroyed: It is
// not destroyed instead." Two destruction paths are covered:
//
// 1. Hits — a single-use cancellation of one incoming hit before it is
//    assigned to your units. In this engine a pending hit is what destroys a
//    (non-sustaining) unit, so cancelling one hit is exactly "one unit that
//    would have died survives". Fires in any combat context (space, ground,
//    or unit-ability hits like AFB / Space Cannon / Bombardment).
// 2. Direct destroys — opponent effects that bypass the hit pool (Spark,
//    Lash, Strike Wing Alpha's AFB trigger, ...) are countered via the
//    engine's `preventDestroy` hook: the most expensive unit about to die is
//    spared instead, consuming this card's single use.
//
// Both paths share the one `uses`; whichever save happens first spends the
// card. The target lists say which unit types are WORTH the save — with only
// fighters checked off, losing a fighter no longer burns the card. Both paths
// respect them: the hit cancel fires only when the unit it would save is
// checked, and the direct-destroy save spares the most expensive checked
// unit. Self-inflicted destroys (costs like Devotion) are never prevented —
// see `preventDestroy` in `abilities-engine/types.ts`.
export const divinity: Ability<Params> = {
  key: 'TF_DIVINITY',
  name: 'Divinity',
  description:
    'When 1 of your units would be destroyed: It is not destroyed instead.',
  // Single card in the deck — a one-shot toggle (uses: 1), so it can't be
  // bumped past a single save the way Hardlight's uses counter can.
  params: {
    isEnabled: false,
    uses: 1,
    spaceTargets: declareParam<UnitList<boolean>>({
      default: [],
      source: 'spaceCombatParticipating',
      side: 'own',
      defaultItemValue: true,
      filter: { combatMode: 'SPACE' },
    }),
    groundTargets: declareParam<UnitList<boolean>>({
      default: [],
      source: 'groundCombatParticipating',
      side: 'own',
      defaultItemValue: true,
      filter: { combatMode: 'GROUND' },
    }),
  },
  headerUI: 'isEnabled',
  uiConfig: ctx => {
    const key =
      ctx.state.combatMode === 'GROUND' ? 'groundTargets' : 'spaceTargets'
    return [
      {
        key,
        label: 'Units worth saving',
        type: 'unit-list',
        mode: 'checkbox',
        items: ctx.api.own.getUnitVariantsOptions(key),
      },
    ]
  },
  preventDestroy: (params, ids, api) => {
    const checked = new Set(
      (api.getCombatMode() === 'GROUND'
        ? params.groundTargets
        : params.spaceTargets
      )
        .filter(([, enabled]) => enabled)
        .map(([key]) => key),
    )
    // Spare the most valuable (highest-cost) checked unit about to die.
    let best: UnitId | undefined
    let bestCost = -1
    for (const id of ids) {
      const key = api.getUnitVariantKey(id)
      if (!key || !checked.has(key)) continue
      const cost = api.getUnitStats(key)?.COST || 0
      if (cost > bestCost) {
        best = id
        bestCost = cost
      }
    }
    return best === undefined ? [] : [best]
  },
  invoke: [
    {
      timing: 'BEFORE_ASSIGN_HITS',
      isCallable: (params, ctx) => {
        const saved = savedByHitCancel(ctx)
        if (saved === undefined) return false
        const variant = ctx.api.own.getUnitVariantKey(saved)
        if (!variant) return false
        const targets = ctx.utils.getFlat(
          ctx.state.combatMode === 'GROUND'
            ? params.groundTargets
            : params.spaceTargets,
        )
        return targets.includes(variant)
      },
      call: ctx => {
        ctx.api.own.reduceHits(1)
      },
    },
  ],
}
