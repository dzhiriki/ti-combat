import type { Ability } from '@/combat'
import type { UnitBaseType } from '@/types'

export const helTitan: Ability = {
  key: 'HEL_TITAN',
  name: 'Hel-Titan',
  description: 'This unit is treated as both a structure and a ground force',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  readOnly: true,
  declareParamChange: () => [{ key: 'groundForces', value: 'PDS' }],
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        ctx.api.own.updateAbilityConfig('SETTINGS', {
          groundForces: (current: UnitBaseType[]) => [...current, 'PDS'],
        })
      },
    },
  ],
}
