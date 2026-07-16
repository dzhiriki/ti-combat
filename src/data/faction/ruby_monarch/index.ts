import rubyMonarchIcon from '@/assets/faction/ruby_monarch.svg?raw'
import { sustainDamage } from '@/data/abilities/general/sustain-damage'
import type { Faction } from '@/types'

export const ruby_monarch: Faction = {
  name: 'The Ruby Monarch',
  icon: rubyMonarchIcon,
  system: 'TWILIGHTS_FALL',
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'The Scarlet Knife',
        DESCRIPTION:
          'DEPLOY: At the start of your turn, you may discard 1 of your abilities or genomes to place this unit from your reinforcements into a system that contains your ships.',
        FLEET_POOL_COST: 1,
        COST: 8,
        COMBAT: [5, 2],
        MOVE: 2,
        CAPACITY: 3,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
    },
    MECH: {
      BASE: {
        NAME: 'The Sharpened Edge',
        DESCRIPTION:
          "DEPLOY: When your flagship is placed, you may place 1 mech into your flagship's space area.",
        COST: 2,
        COMBAT: [6, 1],
        CAPACITY_COST: 1,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
    },
  },
}
