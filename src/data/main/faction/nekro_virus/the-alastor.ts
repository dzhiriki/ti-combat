import type { Ability } from '@/combat'

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
  declareParamChange: () => [{ key: 'SHIPS', value: 'GROUND_FORCES' }],
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      call: ctx => {
        const selected = ctx.api.own.system
          .getUnits(undefined, { includeVariants: true })
          .filter(id => ctx.api.own.isUnitCategory(id, 'GROUND_FORCES'))
        ctx.api.own.setUnitCategory(selected, 'SHIPS', true)
        ctx.api.own.setUnitParticipation(selected, true)
      },
    },
  ],
}
