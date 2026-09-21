import councilKeleresIcon from '@/assets/faction/council_keleres.svg?raw'
import type { Ability } from '@/combat'
import { overwingZeta } from '@/data/main/faction/council_keleres/overwing-zeta'
import { cloneAbility } from '@/data/tf/clone-ability'

export const artemirisAscendant: Ability = cloneAbility(overwingZeta, {
  key: 'TF_ARTEMIRIS_ASCENDANT',
  name: 'Artemiris Ascendant',
  icon: councilKeleresIcon,
})
