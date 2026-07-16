import type { Ability } from '@/combat'

// Twilight's Fall action card, like TI4's Direct Hit but usable in ground
// combat as well as space combat. There is no ability-level combat-mode
// restriction, so it also destroys a mech that used Sustain Damage — not only
// ships. Units flagged DIRECT_HIT_IMMUNE (e.g. the Spark-immune dreadnought
// upgrades) are unaffected, and uses are only consumed on a real kill.
export const spark: Ability = {
  key: 'TF_SPARK',
  name: 'Spark',
  description:
    "After another player's unit uses Sustain Damage to cancel a hit produced by your units or abilities: Destroy that unit.",
  params: {
    isEnabled: true,
    uses: 0,
  },
  headerUI: 'uses',
  invoke: [
    {
      timing: 'AFTER_SUSTAIN_DAMAGE_USE',
      isCallable: (_params, ctx, unitId) => {
        if (!ctx.api.opponent.hasUnit(unitId)) return false
        return !ctx.api.opponent.getUnitStats(unitId)?.DIRECT_HIT_IMMUNE
      },
      call: (ctx, _params, unitId) => {
        ctx.api.opponent.destroyUnits(unitId)
      },
    },
  ],
}
