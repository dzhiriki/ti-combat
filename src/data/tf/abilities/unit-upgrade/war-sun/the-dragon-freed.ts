import obsidianIcon from '@/assets/faction/obsidian.svg?raw'
import type { Ability } from '@/combat'

import { createTfUnitUpgrade } from '../create-tf-unit-upgrade'

export const theDragonFreed: Ability = createTfUnitUpgrade({
  key: 'TF_UPGRADE_THE_DRAGON_FREED',
  icon: obsidianIcon,
  name: 'The Dragon, Freed',
  description:
    'When this unit uses Bombardment, it uses it against every planet in its system and adjacent systems, ignoring Planetary Shield.',
  unitType: 'WAR_SUN',
  cost: 12,
  combat: [3, 3],
  move: 2,
  capacity: 6,
  sustain: true,
  bombardment: [3, 3],
  disablePlanetaryShield: true,
})
