import sardakkNorrIcon from '@/assets/faction/sardakk_norr.svg?raw'
import type { Ability } from '@/combat'
import { valkyrieParticleWeave as ti4ValkyrieParticleWeave } from '@/data/main/faction/sardakk_norr/valkyrie-particle-weave'
import { cloneAbility } from '@/data/tf/clone-ability'

export const valkyrieParticleWeave: Ability = cloneAbility(
  ti4ValkyrieParticleWeave,
  {
    key: 'TF_VALKYRIE_PARTICLE_WEAVE',
    icon: sardakkNorrIcon,
  },
)
