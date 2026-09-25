import type { CombatStateConfig } from '@/hooks/combat-setup/build-combat-state'

export default {
  system: 'TI4',
  mode: 'SPACE',
  attacker: { faction: 'ARBOREC', units: { FIGHTER: 15 } },
  defender: { faction: 'ARBOREC', units: { FIGHTER: 15 } },
} satisfies CombatStateConfig
