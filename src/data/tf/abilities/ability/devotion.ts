import yinBrotherhoodIcon from '@/assets/faction/yin_brotherhood.svg?raw'
import type { Ability } from '@/combat'
import { devotion as ti4Devotion } from '@/data/main/faction/yin_brotherhood/devotion'
import { cloneAbility } from '@/data/tf/clone-ability'

export const devotion: Ability = cloneAbility(ti4Devotion, {
  key: 'TF_DEVOTION',
  icon: yinBrotherhoodIcon,
})
