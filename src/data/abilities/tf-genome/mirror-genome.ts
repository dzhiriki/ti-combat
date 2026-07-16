import type { Ability } from '@/combat'

// Twilight's Fall genome. Its combat-relevant effect matches Cloak / Solar
// Flare — when you move ships, Space Cannon cannot be used against them — but it
// carries a distinct key so a faction can hold both Cloak and Mirror Genome.
export const mirrorGenome: Ability = {
  key: 'TF_MIRROR_GENOME',
  name: 'Mirror Genome',
  description:
    'When you move ships: Space Cannon cannot be used against those ships.',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        ctx.api.opponent.setUnitAbilityCannotBeUsed(
          'SPACE_CANNON',
          ctx.this.key,
        )
      },
    },
  ],
}
