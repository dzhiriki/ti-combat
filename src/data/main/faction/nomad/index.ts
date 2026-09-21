import nomadIcon from '@/assets/faction/nomad.svg?raw'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import type { Faction } from '@/types'

import { cavalry } from './cavalry'
import { quantumManipulator } from './quantum-manipulator'
import { temporalCommandSuite } from './temporal-command-suite'
import { thundarian } from './thundarian'

export const nomad: Faction = {
  name: 'Nomad',
  icon: nomadIcon,
  abilities: {
    ability: [],
    technology: [temporalCommandSuite],
    promissory: [cavalry],
    agent: [thundarian],
  },
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'Memoria I',
        DESCRIPTION:
          'You may treat this unit as if it were adjacent to systems that contain 1 or more of your mechs.',
        FLEET_POOL_COST: 1,
        COST: 8,
        COMBAT: [7, 2],
        MOVE: 1,
        CAPACITY: 3,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
          AFB: [8, 3],
        },
        ABILITIES: [sustainDamage],
      },
      UPGRADED: {
        NAME: 'Memoria II',
        DESCRIPTION:
          'You may treat this unit as if it were adjacent to systems that contain 1 or more of your mechs.',
        COMBAT: [5, 2],
        MOVE: 2,
        CAPACITY: 6,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
          AFB: [5, 3],
        },
      },
    },
    MECH: {
      BASE: {
        NAME: 'Quantum Manipulator',
        DESCRIPTION:
          'While this unit is in a space area during combat, you may use its Sustain Damage ability to cancel a hit that is produced against your ships in this system.',
        COST: 2,
        COMBAT: [6, 1],
        CAPACITY_COST: 1,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [quantumManipulator, sustainDamage],
      },
    },
  },
}
