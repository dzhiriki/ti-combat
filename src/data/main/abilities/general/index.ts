import { disablePlanetaryShield } from './disable-planetary-shield'
import { planetaryShield } from './planetary-shield'
import { preDamaged } from './pre-damaged'
import { preGalvanized } from './pre-galvanized'
import { settings } from './settings'
import { sustainDamage } from './sustain-damage'
import { unitPriority } from './unit-priority'

export const SHARED_UNIT_ABILITY_KEYS: ReadonlySet<string> = new Set([
  'SUSTAIN_DAMAGE',
  'PLANETARY_SHIELD',
  'DISABLE_PLANETARY_SHIELD',
])

export default [
  settings,
  unitPriority,
  preGalvanized,
  preDamaged,
  sustainDamage,
  planetaryShield,
  disablePlanetaryShield,
]
