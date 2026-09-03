import { type Ability, declareParam } from '@/combat'
import type { UnitList } from '@/types'

type Params = {
  targets: UnitList<boolean>
}

export const directHit: Ability<Params> = {
  key: 'DIRECT_HIT',
  name: 'Direct Hit',
  description:
    "After another player's ship uses Sustain Damage to cancel a hit produced by your units or abilities: Destroy that ship.",
  context: 'SPACE',
  params: {
    isEnabled: true,
    uses: 0,
    targets: declareParam<UnitList<boolean>>({
      default: [],
      source: 'nonFighterShips',
      side: 'opponent',
      defaultItemValue: true,
      filter: {
        combatMode: 'SPACE',
      },
    }),
  },
  headerUI: 'uses',
  uiConfig: ctx => [
    {
      key: 'targets',
      type: 'unit-list',
      mode: 'checkbox',
      items: ctx.api.opponent.getUnitVariantsOptions('targets'),
    },
  ],
  invoke: [
    {
      timing: 'AFTER_SUSTAIN_DAMAGE_USE',
      isCallable: (params, ctx, unitId) => {
        if (!ctx.api.opponent.hasUnit(unitId)) return false
        const variant = ctx.api.opponent.getUnitVariantKey(unitId)!
        const targets = ctx.utils.getFlat(params.targets)
        if (!targets.includes(variant)) return false
        const stats = ctx.api.opponent.getUnitStats(unitId)!
        if (stats.DIRECT_HIT_IMMUNE) return false
        return true
      },
      call: (ctx, _params, unitId) => {
        ctx.api.opponent.destroyUnits(unitId)
      },
    },
  ],
}
