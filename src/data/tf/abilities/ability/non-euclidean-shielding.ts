import baronyOfLetnevIcon from '@/assets/faction/barony_of_letnev.svg?raw'
import type { Ability } from '@/combat'
import { nonEuclideanShielding as ti4NonEuclideanShielding } from '@/data/main/faction/barony_of_letnev/non-euclidean-shielding'
import { cloneAbility } from '@/data/tf/clone-ability'

export const nonEuclideanShielding: Ability = cloneAbility(
  ti4NonEuclideanShielding,
  {
    key: 'TF_NON_EUCLIDEAN_SHIELDING',
    icon: baronyOfLetnevIcon,
  },
)
