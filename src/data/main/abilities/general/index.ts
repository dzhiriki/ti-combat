import { disablePlanetaryShield } from './disable-planetary-shield'
import { planetaryShield } from './planetary-shield'
import { preDamaged } from './pre-damaged'
import { preGalvanized } from './pre-galvanized'
import { settings } from './settings'
import { sustainDamage } from './sustain-damage'
import { unitPriority } from './unit-priority'

export default [
  settings,
  unitPriority,
  preGalvanized,
  preDamaged,
  sustainDamage,
  planetaryShield,
  disablePlanetaryShield,
]
