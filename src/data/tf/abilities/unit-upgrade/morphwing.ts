import type { Ability } from '@/combat'
import type { UnitBaseType } from '@/types'

export const morphwingDeclareParamChange: NonNullable<
  Ability['declareParamChange']
> = () => [{ key: 'groundForces', value: 'FIGHTER' }]

// The Naalu flagship's invasion clause on a fighter card (see
// `faction/naalu_collective/matriarch.ts`). Fighters join the ground forces
// at COMMIT_UNITS rather than PREPARE, so they are still in the space area
// while Bombardment resolves and only become targets from Space Cannon
// Defense onwards. Matriarch scopes this with `side: 'attacker'`; a shared
// upgrade card can't — the ability also carries the stat block both sides
// need — so the invoke gates on the side itself.
export const morphwingCommitInvoke: Ability['invoke'][number] = {
  timing: 'COMMIT_UNITS',
  isCallable: (_params, ctx) => ctx.side === 'attacker',
  call: ctx => {
    ctx.api.own.updateAbilityConfig('SETTINGS', {
      groundForces: (current: UnitBaseType[]) => [...current, 'FIGHTER'],
    })
  },
}
