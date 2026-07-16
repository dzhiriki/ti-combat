import type { Ability } from '@/combat'

declare global {
  interface AbilityConfigMap {
    TF_CONVERGE: Record<string, never>
  }
}

// Twilight's Fall action card. Both clauses are consumed by the phase
// drivers, so this ability itself has no invoke (and no combat-mode
// restriction — SCO fires in space combat, SCD in ground combat):
// - Space Cannon Offense: hits must be assigned to non-fighter ships, if
//   able (mirrors Graviton Laser System; see space-cannon-offense.ts).
// - Space Cannon Defense: hits must be assigned to mechs, if able (see
//   space-cannon-defense.ts).
export const converge: Ability = {
  key: 'TF_CONVERGE',
  name: 'Converge',
  description:
    'Before you roll dice for Space Cannon: during Space Cannon Offense your hits must be assigned to non-fighter ships, if able; during Space Cannon Defense your hits must be assigned to mechs, if able.',
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  invoke: [],
}
