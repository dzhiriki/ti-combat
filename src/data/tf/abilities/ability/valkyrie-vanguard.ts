import type { Ability } from '@/combat'
import { ghomSekkus } from '@/data/main/faction/sardakk_norr/ghom-sekkus'
import { cloneAbility } from '@/data/tf/clone-ability'

export const valkyrieVanguard: Ability = cloneAbility(ghomSekkus, {
  key: 'TF_VALKYRIE_VANGUARD',
  name: 'Valkyrie Vanguard',
})
