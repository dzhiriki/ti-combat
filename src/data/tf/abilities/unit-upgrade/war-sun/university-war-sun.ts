import universitiesOfJolNarIcon from '@/assets/faction/universities_of_jol_nar.svg?raw'
import type { Ability } from '@/combat'

import { createTfUnitUpgrade } from '../create-tf-unit-upgrade'

export const universityWarSun: Ability = createTfUnitUpgrade({
  key: 'TF_UPGRADE_UNIVERSITY_WAR_SUN',
  icon: universitiesOfJolNarIcon,
  name: 'University War Sun',
  description: "Other players' units in this system lose Planetary Shield.",
  unitType: 'WAR_SUN',
  cost: 10,
  combat: [4, 3],
  move: 3,
  capacity: 6,
  sustain: true,
  bombardment: [4, 3],
  disablePlanetaryShield: true,
})
