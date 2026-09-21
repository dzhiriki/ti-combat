import type { Ability } from '@/combat'
import type { UnitBaseType } from '@/types'

export const matriarch: Ability = {
  key: 'MATRIARCH',
  name: 'Matriarch',
  description:
    'During an invasion in this system, you may commit fighters to planets as if they were ground forces. When combat ends, return those units to the space area.',
  context: 'GROUND',
  side: 'attacker',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  declareParamChange: () => [{ key: 'groundForces', value: 'FIGHTER' }],
  invoke: [
    {
      timing: 'COMMIT_UNITS',
      call: ctx => {
        ctx.api.own.updateAbilityConfig('SETTINGS', {
          groundForces: (current: UnitBaseType[]) => [...current, 'FIGHTER'],
        })
      },
    },
  ],
}
