import type { Ability } from '@/combat'
import { thundarian } from '@/data/main/faction/nomad/thundarian'
import { cloneAbility } from '@/data/tf/clone-ability'

export const temporalGenome: Ability = cloneAbility(thundarian, {
  key: 'TF_TEMPORAL_GENOME',
  name: 'Temporal Genome',
})
