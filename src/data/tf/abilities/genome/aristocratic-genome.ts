import type { Ability } from '@/combat'
import { viscountUnlenn } from '@/data/main/faction/barony_of_letnev/viscount-unlenn'
import { cloneAbility } from '@/data/tf/clone-ability'

export const aristocraticGenome: Ability = cloneAbility(viscountUnlenn, {
  key: 'TF_ARISTOCRATIC_GENOME',
  name: 'Aristocratic Genome',
})
