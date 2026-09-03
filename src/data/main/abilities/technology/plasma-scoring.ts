import { z } from 'zod/mini'

import type { Ability } from '@/combat'

export const plasmaScoring: Ability = {
  key: 'PLASMA_SCORING',
  name: 'Plasma Scoring',
  description:
    'When 1 or more of your units use Bombardment or Space Cannon, 1 of those units may roll 1 additional die.',
  paramsSchema: z.object({
    strategy: z.string(),
  }),
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: ['BOMBARDMENT', 'SPACE_CANNON_OFFENSE', 'SPACE_CANNON_DEFENSE'],
      call: ctx => {
        ctx.api.own.addDiceCount(1, 'BEST')
      },
    },
  ],
}
