import type { CombatStateConfig } from '@/hooks/combat-setup/build-combat-state'

export default {
  system: 'TI4',
  mode: 'SPACE',
  attacker: {
    faction: 'ARBOREC',
    units: { DREADNOUGHT: 2, FIGHTER: 5 },
    abilities: { DURANIUM_ARMOR: true },
  },
  defender: {
    faction: 'ARBOREC',
    units: { DREADNOUGHT: 2, FIGHTER: 5 },
  },
} satisfies CombatStateConfig
