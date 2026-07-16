import type { Ability } from '@/combat'

// Twilight's Fall genome. After one of your units is destroyed during combat,
// roll 1 die; if the result is ≥ that unit's combat value, your opponent must
// destroy 1 of their units. This is Courageous to the End with a single die and
// no space-only restriction. When several of your units die together, the
// lowest combat value (easiest threshold) is used, as the player would choose.
export const valiantGenome: Ability = {
  key: 'TF_VALIANT_GENOME',
  name: 'Valiant Genome',
  description:
    "After one of your units is destroyed during combat: Roll 1 die. If the result is equal to or greater than that unit's combat value, your opponent must destroy 1 of their units.",
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'AFTER_DESTROY',
      isCallable: (_params, ctx, ids) => {
        const hasOwn = ids.some(id => ctx.api.own.getUnitVariantKey(id) != null)
        if (!hasOwn) return false
        return ctx.api.opponent.getActiveBaseTypes().length > 0
      },
      call: (ctx, _params, ids) => {
        let hitValue: number | undefined
        for (const id of ids) {
          const key = ctx.api.own.getUnitVariantKey(id)
          if (!key) continue
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
