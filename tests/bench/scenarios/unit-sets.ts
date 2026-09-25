import type {
  CombatStateConfig,
  SideConfig,
} from '@/hooks/combat-setup/build-combat-state'

// A spread of small mirror combats over unit-type subsets, like the snapshot
// suites. Dominated by per-combat setup rather than deep search.

const TYPES: SideConfig['units'] = {
  FLAGSHIP: 1,
  WAR_SUN: 1,
  DREADNOUGHT: 1,
  CARRIER: 1,
  CRUISER: 1,
  DESTROYER: 1,
  FIGHTER: 2,
  PDS: 1,
}

const types = Object.entries(TYPES)
const configs: CombatStateConfig[] = []
for (let mask = 1; mask < 1 << types.length; mask += 41) {
  const units = Object.fromEntries(
    types.filter((_, i) => mask & (1 << i)),
  ) as SideConfig['units']
  configs.push({
    system: 'TI4',
    mode: 'SPACE',
    attacker: { faction: 'ARBOREC', units },
    defender: { faction: 'ARBOREC', units },
  })
}

export default configs
