import type { Ability } from '@/combat'
import { trrakanAunZulok } from '@/data/main/faction/argent_flight/trrakan-aun-zulok'
import { cloneAbility } from '@/data/tf/clone-ability'

export const zealous: Ability = cloneAbility(trrakanAunZulok, {
  key: 'TF_ZEALOUS',
  name: 'Zealous',
})
