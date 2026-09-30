import type { Ability } from '@/combat'
import { STRUCTURES, UNIT_ABILITIES } from '@/constants/units'
import { SPACE_SURFACE_ID } from '@/types'

const ALLOWED_SURFACES = ['SPACE', 'PLANET'] as const

export const miniaturization: Ability = {
  key: 'MINIATURIZATION',
  name: 'Miniaturization',
  description:
    'Your structures can be transported by any ship; this does not require or count against capacity. While your structures are in the space area, they cannot use their unit abilities. At the end of your tactical actions, you may place your structures that are in space areas onto planets you control in their respective systems.',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  readOnly: true,
  declareChanges: ctx => {
    for (const structure of STRUCTURES) {
      ctx.api.own.modifyUnitType(structure, {
        ALLOWED_SURFACES,
      })
    }
  },
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        ctx.invokeChanges()
        for (const unitAbility of UNIT_ABILITIES) {
          ctx.api.own.setUnitAbilityCannotBeUsed(
            unitAbility,
            ctx.this.key,
            'STRUCTURES',
            SPACE_SURFACE_ID,
          )
        }
      },
    },
  ],
}
