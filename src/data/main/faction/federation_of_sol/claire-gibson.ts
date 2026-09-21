import federationOfSolIcon from '@/assets/faction/federation_of_sol.svg?raw'
import type { Ability } from '@/combat/abilities-engine/types'

export const claireGibson: Ability = {
  key: 'CLAIRE_GIBSON',
  name: 'Claire Gibson',
  description:
    'At the start of a ground combat on a planet you control: You may place 1 infantry from your reinforcements on that planet.',
  icon: federationOfSolIcon,
  context: 'GROUND',
  side: 'defender',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      context: 'GROUND_COMBAT',
      call: ctx => {
        ctx.api.own.placeUnits({ INFANTRY: 1 })
      },
    },
  ],
}
