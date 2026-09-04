import type { Ability } from '@/combat'
import { tellurian } from '@/data/main/faction/titans_of_ul/tellurian'
import { cloneAbility } from '@/data/tf/clone-ability'

export const altruisticGenome: Ability = cloneAbility(tellurian, {
  key: 'TF_ALTRUISTIC_GENOME',
  name: 'Altruistic Genome',
})
