import type { Ability } from '@/combat'

// Twilight's Fall genome. After one of your destroyers or cruisers is destroyed,
// place up to 2 fighters from your reinforcements into that unit's system —
// reinforcing the ongoing space combat.
export const splittingGenome: Ability = {
  key: 'TF_SPLITTING_GENOME',
  name: 'Splitting Genome',
  description:
    "After your destroyer or cruiser is destroyed: Place up to 2 fighters from your reinforcements in that unit's system.",
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'AFTER_DESTROY',
      isCallable: (_params, ctx, ids) =>
        ids.some(id => {
          const key = ctx.api.own.getUnitVariantKey(id)
          if (!key) return false
          const base = key.split(':')[0]
          return base === 'DESTROYER' || base === 'CRUISER'
        }),
      call: ctx => {
        ctx.api.own.placeUnits({ FIGHTER: 2 })
      },
    },
  ],
}
