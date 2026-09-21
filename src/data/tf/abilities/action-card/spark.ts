import { type Ability, declareParam } from '@/combat'
import type { UnitList } from '@/types'

type Params = {
  spaceTargets: UnitList<boolean>
  groundTargets: UnitList<boolean>
}

// Twilight's Fall action card, like TI4's Direct Hit but usable in ground
// combat as well as space combat. There is no ability-level combat-mode
// restriction, so it also destroys a mech that used Sustain Damage — not only
// ships. The target lists play Direct Hit's role: a use is only spent on unit
// types you have checked, so cheap sustainers don't drain the cards you are
// saving for a war sun. Units flagged DIRECT_HIT_IMMUNE (e.g. the Spark-immune
// dreadnought upgrades) are unaffected, and uses are only consumed on a real
// kill.
export const spark: Ability<Params> = {
  key: 'TF_SPARK',
  name: 'Spark',
  description:
    "After another player's unit uses Sustain Damage to cancel a hit produced by your units or abilities: Destroy that unit.",
  params: {
    isEnabled: true,
    uses: 0,
    // Sourced from the participation lists (not `nonFighterShips` /
    // `groundForces`) so units granted space participation by other cards —
    // e.g. Starlancer XI mechs — stay targetable; fighters and infantry are
    // excluded as they can never sustain.
    spaceTargets: declareParam<UnitList<boolean>>({
      default: [],
      source: 'spaceCombatParticipating',
      side: 'opponent',
      defaultItemValue: true,
      filter: { combatMode: 'SPACE', exclude: ['FIGHTER'] },
    }),
    groundTargets: declareParam<UnitList<boolean>>({
      default: [],
      source: 'groundCombatParticipating',
      side: 'opponent',
      defaultItemValue: true,
      filter: { combatMode: 'GROUND', exclude: ['INFANTRY'] },
    }),
  },
  headerUI: 'uses',
  uiConfig: ctx => {
    const key =
      ctx.state.combatMode === 'GROUND' ? 'groundTargets' : 'spaceTargets'
    return [
      {
        key,
        type: 'unit-list',
        mode: 'checkbox',
        items: ctx.api.opponent.getUnitVariantsOptions(key),
      },
    ]
  },
  invoke: [
    {
      timing: 'AFTER_SUSTAIN_DAMAGE_USE',
      isCallable: (params, ctx, unitId) => {
        if (!ctx.api.opponent.hasUnit(unitId)) return false
        const variant = ctx.api.opponent.getUnitVariantKey(unitId)
        if (!variant) return false
        const targets = ctx.utils.getFlat(
          ctx.state.combatMode === 'GROUND'
            ? params.groundTargets
            : params.spaceTargets,
        )
        if (!targets.includes(variant)) return false
        return !ctx.api.opponent.getUnitStats(unitId)?.DIRECT_HIT_IMMUNE
      },
      call: (ctx, _params, unitId) => {
        ctx.api.opponent.destroyUnits(unitId)
      },
    },
  ],
}
