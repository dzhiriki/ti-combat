import sardakkNorrIcon from '@/assets/faction/sardakk_norr.svg?raw'
import type { Ability } from '@/combat'
import { unrelenting as ti4Unrelenting } from '@/data/main/faction/sardakk_norr/unrelenting'
import { cloneAbility } from '@/data/tf/clone-ability'

export const unrelenting: Ability = cloneAbility(ti4Unrelenting, {
  key: 'TF_UNRELENTING',
  icon: sardakkNorrIcon,
})
