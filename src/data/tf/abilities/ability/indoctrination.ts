import yinBrotherhoodIcon from '@/assets/faction/yin_brotherhood.svg?raw'
import type { Ability } from '@/combat'
import { indoctrination as ti4Indoctrination } from '@/data/main/faction/yin_brotherhood/indoctrination'
import { cloneAbility } from '@/data/tf/clone-ability'

export const indoctrination: Ability = cloneAbility(ti4Indoctrination, {
  key: 'TF_INDOCTRINATION',
  icon: yinBrotherhoodIcon,
})
