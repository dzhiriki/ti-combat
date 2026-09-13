import crimsonRebellionIcon from '@/assets/faction/crimson_rebellion.svg?raw'
import type { Ability } from '@/combat'
import { fragmentReality } from '@/data/main/faction/crimson_rebellion/fragment-reality'
import { cloneAbility } from '@/data/tf/clone-ability'

export const dimensionalReflection: Ability = cloneAbility(fragmentReality, {
  key: 'TF_DIMENSIONAL_REFLECTION',
  name: 'Dimensional Reflection',
  icon: crimsonRebellionIcon,
})
