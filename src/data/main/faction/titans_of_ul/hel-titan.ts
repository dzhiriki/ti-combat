import type { Ability } from '@/combat'

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
  invoke: [],
}
