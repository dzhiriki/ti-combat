import type { Ability } from '@/combat'
import { evelynDelouis } from '@/data/main/faction/federation_of_sol/evelyn-delouis'
import { cloneAbility } from '@/data/tf/clone-ability'

export const humanGenome: Ability = cloneAbility(evelynDelouis, {
  key: 'TF_HUMAN_GENOME',
  name: 'Human Genome',
})
