import { artemirisAscendant } from './artemiris-ascendant'
import { dimensionalReflection } from './dimensional-reflection'
import { insurrection } from './insurrection'
import { intelligenceUnshackled } from './intelligence-unshackled'

// The Paradigms deck (hero-style, once per combat), alphabetized by card
// name. The ship-placement paradigms reuse the matching hero
// implementations: placing ships at the start of combat differs from
// fielding them from the outset (they dodge Space Cannon Offense and other
// pre-combat effects).
export default [
  artemirisAscendant,
  dimensionalReflection,
  insurrection,
  intelligenceUnshackled,
]
