import type { Ability } from '@/combat'
import { solarFlare } from '@/data/main/abilities/action-card/solar-flare'
import { cloneAbility } from '@/data/tf/clone-ability'

export const cloak: Ability = cloneAbility(solarFlare, {
  key: 'TF_CLOAK',
  name: 'Cloak',
})
