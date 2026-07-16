import type { Ability } from '@/combat'

declare global {
  interface AbilityConfigMap {
    TF_CONVERGE: Record<string, never>
  }
}

// Twilight's Fall action card. Its Space Cannon Offense clause mirrors Graviton
// Laser System — hits produced by your Space Cannon must be assigned to
// non-fighter ships, if able — and is consumed by the Space Cannon Offense
// phase (see space-cannon-offense.ts), so this ability itself has no invoke.
//
// The card's Space Cannon Defense → mechs clause is not yet modeled.
export const converge: Ability = {
  key: 'TF_CONVERGE',
  name: 'Converge',
  description:
    'Before you roll dice for Space Cannon: your hits must be assigned to non-fighter ships during Space Cannon Offense, if able.',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  invoke: [],
}
