import type { Ability } from '@/combat'

// Twilight's Fall Abilities-deck card (from Obsidian's kit). The full card:
// "When you gain this card, put The Fracture into play. Apply +1 to the MOVE
// value of each of your ships that starts its movement in The Fracture. Apply
// +2 to the result of each of your units' combat rolls in The Fracture." Only
// the combat clause matters here; whether the combat takes place in The
// Fracture is asserted by enabling the card (a single-system calculator can't
// know the map).
export const planesplitter: Ability = {
  key: 'TF_PLANESPLITTER',
  name: 'Planesplitter',
  description:
    'Apply +2 to the result of each of your units’ combat rolls in The Fracture.',
  warning: 'Enable only when the combat takes place in The Fracture.',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      call: ctx => {
        ctx.api.own.applyBonusToResult(2)
      },
    },
  ],
}
