import ghostsOfCreussIcon from '@/assets/faction/ghosts_of_creuss.svg?raw'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import type { Faction } from '@/types'

import { dimensionalSplicer } from './dimensional-splicer'

export const ghosts_of_creuss: Faction = {
  name: 'Ghosts of Creuss',
  icon: ghostsOfCreussIcon,
  abilities: {
    technology: [dimensionalSplicer],
  },
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'Hil Colish',
        DESCRIPTION:
          "This ship's system contains a delta wormhole. After you activate a system that contains a wormhole, this ship may move through wormholes.",
        FLEET_POOL_COST: 1,
        COST: 8,
        COMBAT: [5, 1],
        MOVE: 1,
        CAPACITY: 3,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Icarus Drive',
        DESCRIPTION:
          'After any player activates a system, you may remove this unit from the game board to place or move a Creuss wormhole token into this system.',
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
