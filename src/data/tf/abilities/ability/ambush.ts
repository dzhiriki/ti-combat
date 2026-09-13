import mentakCoalitionIcon from '@/assets/faction/mentak_coalition.svg?raw'
import type { Ability } from '@/combat'
import { ambush as ti4Ambush } from '@/data/main/faction/mentak_coalition/ambush'
import { cloneAbility } from '@/data/tf/clone-ability'

export const ambush: Ability = cloneAbility(ti4Ambush, {
  key: 'TF_AMBUSH',
  icon: mentakCoalitionIcon,
})
