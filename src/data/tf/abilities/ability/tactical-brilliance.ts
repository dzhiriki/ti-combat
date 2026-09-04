import type { Ability } from '@/combat'
import { agnlanOln } from '@/data/main/faction/universities_of_jol_nar/agnlan-oln'
import { cloneAbility } from '@/data/tf/clone-ability'

export const tacticalBrilliance: Ability = cloneAbility(agnlanOln, {
  key: 'TF_TACTICAL_BRILLIANCE',
  name: 'Tactical Brilliance',
})
