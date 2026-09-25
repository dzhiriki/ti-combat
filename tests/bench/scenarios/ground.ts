import type { CombatStateConfig } from '@/hooks/combat-setup/build-combat-state'

export default {
  system: 'TI4',
  mode: 'GROUND',
  attacker: { faction: 'ARBOREC', units: { INFANTRY: 10, MECH: 3 } },
  defender: { faction: 'ARBOREC', units: { INFANTRY: 10, MECH: 2, PDS: 2 } },
} satisfies CombatStateConfig
