import { disablePlanetaryShield } from './disable-planetary-shield'
import { planetaryShield } from './planetary-shield'
import { preDamaged } from './pre-damaged'
import { preGalvanized } from './pre-galvanized'
import { sustainDamage } from './sustain-damage'
import { unitPriority } from './unit-priority'

export default [
  unitPriority,
  preGalvanized,
  preDamaged,
  sustainDamage,
  planetaryShield,
  disablePlanetaryShield,
]
