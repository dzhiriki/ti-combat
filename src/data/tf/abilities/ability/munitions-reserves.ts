import baronyOfLetnevIcon from '@/assets/faction/barony_of_letnev.svg?raw'
import type { Ability } from '@/combat'
import { munitionsReserves as ti4MunitionsReserves } from '@/data/main/faction/barony_of_letnev/munitions-reserves'
import { cloneAbility } from '@/data/tf/clone-ability'

export const munitionsReserves: Ability = cloneAbility(ti4MunitionsReserves, {
  key: 'TF_MUNITIONS_RESERVES',
  icon: baronyOfLetnevIcon,
})
