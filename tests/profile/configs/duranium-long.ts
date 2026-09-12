import { buildCombatState } from '@/hooks/combat-setup/build-combat-state'

export default buildCombatState({
  system: 'TI4',
  mode: 'SPACE',
  attacker: {
    faction: 'ARBOREC',
    units: { WAR_SUN: 2, DREADNOUGHT: 3, FIGHTER: 5 },
    abilities: {
      DURANIUM_ARMOR: true,
    },
  },
  defender: {
    faction: 'ARBOREC',
    units: { WAR_SUN: 2, DREADNOUGHT: 3, FIGHTER: 5 },
  },
})
