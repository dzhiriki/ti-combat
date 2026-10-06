import { describe, expect, it } from 'vitest'

import type { SideConfig } from '@/hooks/combat-setup/build-combat-state'
import { SPACE_SURFACE_ID, type SurfaceId } from '@/types'

import { combatTest } from '../utils/combat-test'
import { PLANET_1, PLANET_2, TWO_PLANET_INVASION } from '../utils/surface-units'

/** L1Z1X fights on planet 2 only; the PDS stands on `pdsPlanet`. */
function harrowOnPlanet2(pdsPlanet: SurfaceId) {
  const defender: SideConfig['placements'] = {
    [PLANET_1]: { INFANTRY: 1 },
    [PLANET_2]: { INFANTRY: 3 },
  }
  defender[pdsPlanet] = { ...defender[pdsPlanet], PDS: 1 }
  const t = combatTest({
    ...TWO_PLANET_INVASION,
    attacker: {
      faction: 'L1Z1X_MINDNET',
      units: {},
      placements: {
        [SPACE_SURFACE_ID]: { DREADNOUGHT: 1 },
        [PLANET_2]: { INFANTRY: 1 },
      },
      abilities: { HARROW: true },
    },
    defender: {
      faction: 'ARBOREC',
      units: {},
      placements: defender,
      abilities: { SPACE_CANNON_DEFENSE: false },
    },
  })
  t.advanceTo('GROUND_COMBAT')
  expect(t.state.activeSurfaceId).toBe(PLANET_2)
  t.advanceRound({ attacker: 0, defender: 0 })
  return t.dicePool()
}

describe('HARROW + PLANETARY_SHIELD', () => {
  it('bombards a planet whose shield is elsewhere', () => {
    const pool = harrowOnPlanet2(PLANET_1)

    expect(pool.hitSource).toBe('BOMBARDMENT')
    expect(pool.attacker).toContainDice('DREADNOUGHT', [5, 1])
  })

  it('cannot bombard a shielded planet', () => {
    expect(harrowOnPlanet2(PLANET_2).hitSource).not.toBe('BOMBARDMENT')
  })
})
