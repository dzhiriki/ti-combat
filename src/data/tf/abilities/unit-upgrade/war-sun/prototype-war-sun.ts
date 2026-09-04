import embersOfMuaatIcon from '@/assets/faction/embers_of_muaat.svg?raw'
import type { Ability } from '@/combat'

import { createTfUnitUpgrade } from '../create-tf-unit-upgrade'

export const prototypeWarSun: Ability = createTfUnitUpgrade({
  key: 'TF_UPGRADE_PROTOTYPE_WAR_SUN',
  icon: embersOfMuaatIcon,
  name: 'Prototype War Sun',
  description: "Other players' units in this system lose Planetary Shield.",
  unitType: 'WAR_SUN',
  cost: 12,
  combat: [3, 3],
  move: 2,
  capacity: 6,
  sustain: true,
  bombardment: [3, 3],
  disablePlanetaryShield: true,
})
