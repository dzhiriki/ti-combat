import naazRokhaAllianceIcon from '@/assets/faction/naaz_rokha_alliance.svg?raw'
import type { Ability } from '@/combat'
import type { UnitBaseType } from '@/types'
import { createStatsInvoke } from '@/utils/create-stats-invoke'

// Carries the Fighter II movement/fleet-pool clause (fighters fill ship
// capacity first, the excess counts against the fleet pool) plus Matriarch's
// invasion clause.
export const morphwing: Ability = {
  key: 'TF_UPGRADE_MORPHWING',
  icon: naazRokhaAllianceIcon,
  name: 'Morphwing',
  description:
    'This unit may move without being transported. Fighters in excess of your ships’ capacity count against your fleet pool. During an invasion in this system, you may commit these units to planets as if they were ground forces. When combat ends, return those units to the space area.',
  params: { isEnabled: false, uses: Infinity },
  headerUI: 'isEnabled',
  exclusiveGroup: 'TF_UNIT_UPGRADE_FIGHTER',
  declareParamChange: () => [{ key: 'groundForces', value: 'FIGHTER' }],
  invoke: [
    createStatsInvoke('FIGHTER', {
      COST: 0.5,
      COMBAT: [7, 1],
      MOVE: 2,
      FLEET_POOL_COST: 1,
      UNIT_ABILITIES: {},
    }),
    // Fighters join ground forces at COMMIT_UNITS rather than PREPARE, so
    // they stay in space for Bombardment and become targets from Space
    // Cannon Defense onwards. Only the attacker may commit them, but the
    // card's stat block applies to either side.
    {
      timing: 'COMMIT_UNITS',
      isCallable: (_params, ctx) => ctx.side === 'attacker',
      call: ctx => {
        ctx.api.own.updateAbilityConfig('SETTINGS', {
          groundForces: (current: UnitBaseType[]) => [...current, 'FIGHTER'],
        })
      },
    },
  ],
}
