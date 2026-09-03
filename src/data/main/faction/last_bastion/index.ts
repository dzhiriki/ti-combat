import lastBastionIcon from '@/assets/faction/last_bastion.svg?raw'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import type { Faction } from '@/types'

import { a3Valiance } from './a3-valiance'
import { apollo } from './apollo'
import { dameBriar } from './dame-briar'
import { phoenixStandard } from './phoenix-standard'
import { proximaTargetingVi } from './proxima-targeting-vi'
import { raiseTheStandard } from './raise-the-standard'
import { theEgeiro } from './the-egeiro'

export const last_bastion: Faction = {
  name: 'Last Bastion',
  icon: lastBastionIcon,
  abilities: {
    faction: [phoenixStandard],
    technology: [proximaTargetingVi],
    promissory: [raiseTheStandard],
    agent: [dameBriar],
    hero: [apollo],
  },
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'The Egeiro',
        DESCRIPTION:
          "Apply +1 to the result of each of this unit's combat rolls for each non-home system that contains a planet you control.",
        FLEET_POOL_COST: 1,
        COST: 8,
        COMBAT: [9, 1],
        MOVE: 1,
        CAPACITY: 3,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
          PRODUCTION: 1,
        },
        ABILITIES: [sustainDamage, theEgeiro],
      },
    },
    MECH: {
      BASE: {
        NAME: 'A3 Valiance',
        DESCRIPTION:
          'When this unit is destroyed, if it was galvanized, galvanize up to 3 of your infantry in its system.',
        COST: 2,
        COMBAT: [6, 1],
        CAPACITY_COST: 1,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage, a3Valiance],
      },
    },
    SPACE_DOCK: {
      BASE: {
        NAME: '4X41C Helios V1',
        DESCRIPTION:
          "This unit's Production value is equal to 2 more than the resource value of this planet. The resource value of this planet is increased by 1. Up to 3 fighters in this system do not count against your ships' capacity.",
        UNIT_ABILITIES: {},
      },
      UPGRADED: {
        NAME: '4X41C Helios V2',
        DESCRIPTION:
          "This unit's Production value is equal to 4 more than the resource value of this planet. The resource value of this planet is increased by 2. Up to 3 fighters in this system do not count against your ships' capacity.",
      },
    },
  },
}
