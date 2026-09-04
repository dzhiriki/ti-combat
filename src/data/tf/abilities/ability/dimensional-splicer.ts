import ghostsOfCreussIcon from '@/assets/faction/ghosts_of_creuss.svg?raw'
import type { Ability } from '@/combat'
import { dimensionalSplicer as ti4DimensionalSplicer } from '@/data/main/faction/ghosts_of_creuss/dimensional-splicer'
import { cloneAbility } from '@/data/tf/clone-ability'

export const dimensionalSplicer: Ability = cloneAbility(ti4DimensionalSplicer, {
  key: 'TF_DIMENSIONAL_SPLICER',
  icon: ghostsOfCreussIcon,
})
