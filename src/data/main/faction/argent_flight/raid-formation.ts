import { type Ability, declareParam } from '@/combat'
import type { UnitList } from '@/types'

type Params = {
  targetPriority: UnitList
}

export const raidFormation: Ability<Params> = {
  key: 'RAID_FORMATION',
  name: 'Raid Formation',
  description:
    "When 1 or more of your units use Anti-Fighter Barrage, for each hit produced in excess of your opponent's fighters, choose 1 of your opponent's ships that has Sustain Damage to become damaged.",
  context: 'SPACE',
  params: {
    isEnabled: true,
    uses: Infinity,
    targetPriority: declareParam<UnitList>({
      default: [],
      source: 'nonFighterShips',
      side: 'opponent',
      filter: { combatMode: 'SPACE' },
    }),
  },
  uiConfig: ctx => [
    {
      key: 'targetPriority',
      type: 'unit-list',
      mode: 'order',
      items: ctx.api.opponent.getUnitVariantsOptions('targetPriority'),
    },
  ],
  invoke: [
    {
      timing: 'AFTER_UNIT_ABILITY_ROLL',
      context: 'AFB',
      isCallable: (_, ctx) => {
        const pendingHits = ctx.api.opponent.getPendingHits()
        const fighterCount = ctx.api.opponent.countUnits('FIGHTER', {
          includeVariants: true,
        })

        return pendingHits > fighterCount
      },
      call: (ctx, params) => {
        const pendingHits = ctx.api.opponent.getPendingHits()
        const fighterCount = ctx.api.opponent.countUnits('FIGHTER', {
          includeVariants: true,
        })
        const excess = pendingHits - fighterCount

        const targets = ctx.api.opponent.findUnitByPriority(
          ctx.utils.getFlat(params.targetPriority),
          {
            includeVariants: false,
            amount: excess,
            predicate: (variant, unitId) => {
              if (
                ctx.api.opponent.isUnitAbilityLost('SUSTAIN_DAMAGE', variant)
              ) {
                return false
              }

              const stats = ctx.api.opponent.getUnitStats(variant)

              if (!stats?.UNIT_ABILITIES?.SUSTAIN_DAMAGE) return false

              return !ctx.api.opponent.getUnitState(unitId)?.isDamaged
            },
          },
        )

        targets.forEach(target => {
          ctx.api.opponent.modifyUnitState(target, {
            isDamaged: true,
          })
        })
      },
    },
  ],
}
