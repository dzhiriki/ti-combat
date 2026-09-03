import type { Ability } from '@/combat'

export const lightrailOrdnance: Ability = {
  key: 'LIGHTRAIL_ORDNANCE',
  name: 'Lightrail Ordnance',
  description:
    "Your space docks gain Space Cannon 5 (x2). You may use your space dock's Space Cannon against ships that are adjacent to their systems.",
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        ctx.api.own.modifyUnitType('SPACE_DOCK', {
          UNIT_ABILITIES: { SPACE_CANNON: [5, 2] },
        })
      },
    },
  ],
}
