import type { Ability } from '@/combat'
import type { UnitId } from '@/types'

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
// card. Self-inflicted destroys (costs like Devotion) are never prevented —
// see `preventDestroy` in `abilities-engine/types.ts`.
export const divinity: Ability = {
  key: 'TF_DIVINITY',
  name: 'Divinity',
  description:
    'When 1 of your units would be destroyed: It is not destroyed instead.',
  // Single card in the deck — a one-shot toggle (uses: 1), so it can't be
  // bumped past a single save the way Hardlight's uses counter can.
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  preventDestroy: (_params, ids, api) => {
    // Spare the most valuable (highest-cost) of the units about to die.
    let best: UnitId | undefined
    let bestCost = -1
    for (const id of ids) {
      const key = api.getUnitVariantKey(id)
      const cost = (key && api.getUnitStats(key)?.COST) || 0
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
      isCallable: (_params, ctx) => ctx.api.own.getPendingHits() > 0,
      call: ctx => {
        ctx.api.own.reduceHits(1)
      },
    },
  ],
}
