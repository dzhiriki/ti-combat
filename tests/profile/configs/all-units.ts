import { buildCombatState } from '@/hooks/combat-setup/build-combat-state'

const UNIT_LIST = {
  FLAGSHIP: 1,
  WAR_SUN: 2,
  DREADNOUGHT: 5,
  CARRIER: 4,
  CRUISER: 8,
  DESTROYER: 8,
}

export default buildCombatState({
  system: 'TI4',
  mode: 'SPACE',
  attacker: {
    faction: 'ARBOREC',
    units: UNIT_LIST,
  },
  defender: {
    faction: 'ARBOREC',
    units: UNIT_LIST,
  },
})
