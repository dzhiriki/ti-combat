import type { Ability } from '@/combat'
import type { UnitBaseType } from '@/types'

export const theAlastor: Ability = {
  key: 'THE_ALASTOR',
  name: 'The Alastor',
  description:
    'At the start of a space combat, choose any number of your ground forces in this system to participate in that combat as if they were ships.',
  context: 'SPACE',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  declareParamChange: (_params, settings) =>
    settings.groundForces.map(u => ({
      key: 'ships',
      value: u,
    })),
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      call: ctx => {
        const settings = ctx.api.own.getAbilityConfig('SETTINGS')
        const groundForces = settings.groundForces

        ctx.api.own.updateAbilityConfig('SETTINGS', {
          ships: (current: UnitBaseType[]) => [
            ...current,
            ...groundForces.filter(u => !current.includes(u)),
          ],
        })
      },
    },
  ],
}
