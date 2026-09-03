import sardakkNorrIcon from '@/assets/faction/sardakk_norr.svg?raw'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import { cmorranNorr } from '@/data/main/faction/sardakk_norr/cmorran-norr'
import { exotrireme } from '@/data/main/faction/sardakk_norr/exotrireme'
import { ghomSekkus } from '@/data/main/faction/sardakk_norr/ghom-sekkus'
import { tekklarLegion } from '@/data/main/faction/sardakk_norr/tekklar-legion'
import { unrelenting } from '@/data/main/faction/sardakk_norr/unrelenting'
import { valkyrieExoskeleton } from '@/data/main/faction/sardakk_norr/valkyrie-exoskeleton'
import { valkyrieParticleWeave } from '@/data/main/faction/sardakk_norr/valkyrie-particle-weave'
import type { Faction } from '@/types'

export const sardakk_norr: Faction = {
  name: "Sardakk N'orr",
  icon: sardakkNorrIcon,
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: "C'morran N'orr",
        DESCRIPTION:
          "Apply +1 to the result of each of your other ship's combat rolls in this system.",
        FLEET_POOL_COST: 1,
        COST: 8,
        COMBAT: [6, 2],
        MOVE: 1,
        CAPACITY: 3,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [cmorranNorr, sustainDamage],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Valkyrie Exoskeleton',
        DESCRIPTION:
          "After this unit uses its Sustain Damage ability during ground combat, it produces 1 hit against your opponent's ground forces on this planet.",
        COST: 2,
        COMBAT: [6, 1],
        CAPACITY_COST: 1,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [valkyrieExoskeleton, sustainDamage],
      },
    },
    DREADNOUGHT: {
      BASE: {
        NAME: 'Exotrireme I',
        FLEET_POOL_COST: 1,
        COST: 4,
        COMBAT: [5, 1],
        MOVE: 1,
        CAPACITY: 1,
        UNIT_ABILITIES: {
          BOMBARDMENT: [4, 2],
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
      UPGRADED: {
        NAME: 'Exotrireme II',
        DESCRIPTION:
          'This unit cannot be destroyed by Direct Hit action cards. After a round of space combat, you may destroy this unit to destroy up to 2 ships in this system.',
        MOVE: 2,
        DIRECT_HIT_IMMUNE: true,
        ABILITIES: [exotrireme, sustainDamage],
      },
    },
  },
  abilities: {
    faction: [unrelenting],
    technology: [valkyrieParticleWeave],
    promissory: [tekklarLegion],
    commander: [ghomSekkus],
  },
}
