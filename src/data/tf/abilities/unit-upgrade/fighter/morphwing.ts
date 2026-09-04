import naazRokhaAllianceIcon from '@/assets/faction/naaz_rokha_alliance.svg?raw'
import type { Ability, AbilityInvoke } from '@/combat'
import type { UnitBaseType } from '@/types'

import { createTfUnitUpgrade } from '../create-tf-unit-upgrade'

const morphwingDeclareParamChange: NonNullable<
  Ability['declareParamChange']
> = () => [{ key: 'groundForces', value: 'FIGHTER' }]

// The Naalu flagship's invasion clause on a fighter card (see
// `faction/naalu_collective/matriarch.ts`). Fighters join the ground forces
// at COMMIT_UNITS rather than PREPARE, so they are still in the space area
// while Bombardment resolves and only become targets from Space Cannon
// Defense onwards. Matriarch scopes this with `side: 'attacker'`; a shared
// upgrade card can't — the ability also carries the stat block both sides
// need — so the invoke gates on the side itself.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const morphwingCommitInvoke: AbilityInvoke<any> = {
  timing: 'COMMIT_UNITS',
  isCallable: (_params, ctx) => ctx.side === 'attacker',
  call: ctx => {
    ctx.api.own.updateAbilityConfig('SETTINGS', {
      groundForces: (current: UnitBaseType[]) => [...current, 'FIGHTER'],
    })
  },
}

// Carries the Fighter II movement/fleet-pool clause (fighters fill ship
// capacity first, the excess counts against the fleet pool) plus Matriarch's
// invasion clause.
export const morphwing: Ability = createTfUnitUpgrade({
  key: 'TF_UPGRADE_MORPHWING',
  icon: naazRokhaAllianceIcon,
  name: 'Morphwing',
  description:
    'This unit may move without being transported. Fighters in excess of your ships’ capacity count against your fleet pool. During an invasion in this system, you may commit these units to planets as if they were ground forces. When combat ends, return those units to the space area.',
  unitType: 'FIGHTER',
  cost: 0.5,
  combat: [7, 1],
  move: 2,
  fleetPoolCost: 1,
  declareParamChange: morphwingDeclareParamChange,
  invokes: [morphwingCommitInvoke],
})
