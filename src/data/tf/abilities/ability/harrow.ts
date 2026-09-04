import l1z1xMindnetIcon from '@/assets/faction/l1z1x_mindnet.svg?raw'
import type { Ability } from '@/combat'
import { harrow as ti4Harrow } from '@/data/main/faction/l1z1x_mindnet/harrow'
import { cloneAbility } from '@/data/tf/clone-ability'

export const harrow: Ability = cloneAbility(ti4Harrow, {
  key: 'TF_HARROW',
  icon: l1z1xMindnetIcon,
})
