import mentakCoalitionIcon from '@/assets/faction/mentak_coalition.svg?raw'
import type { Ability } from '@/combat'
import { sleeperCell } from '@/data/main/faction/mentak_coalition/sleeper-cell'
import { cloneAbility } from '@/data/tf/clone-ability'

export const insurrection: Ability = cloneAbility(sleeperCell, {
  key: 'TF_INSURRECTION',
  name: 'Insurrection',
  icon: mentakCoalitionIcon,
})
