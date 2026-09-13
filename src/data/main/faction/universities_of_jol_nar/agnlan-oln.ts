import universitiesOfJolNarIcon from '@/assets/faction/universities_of_jol_nar.svg?raw'
import type { Ability } from '@/combat'

export const agnlanOln: Ability = {
  key: 'AGNLAN_OLN',
  name: 'Agnlan Oln',
  description:
    'After you roll dice for a unit ability: You may reroll any of those dice.',
  icon: universitiesOfJolNarIcon,
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'REROLL_UNIT_ABILITY_ROLL',
      call: ctx => {
        ctx.api.own.declareReroll({
          target: 'MISSES',
        })
      },
    },
  ],
}
