import baronyOfLetnevIcon from '@/assets/faction/barony_of_letnev.svg?raw'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import type { Faction } from '@/types'

import { arcSecundus } from './arc-secundus'
import { dunlainReaper } from './dunlain-reaper'
import { gravleashManeuvers } from './gravleash-maneuvers'
import { l4Disruptors } from './l4-disruptors'
import { munitionsReserves } from './munitions-reserves'
import { nonEuclideanShielding } from './non-euclidean-shielding'
import { viscountUnlenn } from './viscount-unlenn'
import { warFunding } from './war-funding'

export const barony_of_letnev: Faction = {
  name: 'Barony of Letnev',
  icon: baronyOfLetnevIcon,
  abilities: {
    faction: [munitionsReserves],
    technology: [l4Disruptors, nonEuclideanShielding],
    agent: [viscountUnlenn],
    promissory: [warFunding],
    breakthrough: [gravleashManeuvers],
  },
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'Arc Secundus',
        DESCRIPTION:
          "Other players' units in this system lose Planetary Shield. At the start of each space combat round, repair this ship.",
        FLEET_POOL_COST: 1,
        COST: 8,
        COMBAT: [5, 2],
        MOVE: 1,
        CAPACITY: 3,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
          BOMBARDMENT: [5, 3],
        },
        ABILITIES: [arcSecundus, sustainDamage],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Dunlain Reaper',
        DESCRIPTION:
          'Deploy: At the start of a round of ground combat, you may spend 2 resources to replace 1 of your infantry in that combat with 1 mech.',
        COST: 2,
        COMBAT: [6, 1],
        CAPACITY_COST: 1,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
          DEPLOY: dunlainReaper,
        },
        ABILITIES: [sustainDamage],
      },
    },
  },
}
