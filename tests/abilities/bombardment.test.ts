import { describe, expect, it } from 'vitest'

import { type DicePool, makeUnitLocator } from '@/combat'
import { CombatSetup } from '@/hooks/combat-setup'
import { SPACE_SURFACE_ID } from '@/types'

import { combatTest } from '../utils/combat-test'
import { setupOptions } from '../utils/setup-options'
import {
  getSurfaceUnitIds,
  PLANET_1,
  PLANET_2,
  TWO_PLANET_INVASION,
} from '../utils/surface-units'

const at = makeUnitLocator

function bombardmentPools(log: ReturnType<typeof combatTest>['log']) {
  return log
    .filter(entry => entry.path.at(-1) === 'DICE_POOL')
    .map(entry => entry.data?.[0] as { attacker: DicePool; hitSource: string })
    .filter(pool => pool.hitSource === 'BOMBARDMENT')
}

function invasion(units?: [string, number][]) {
  return combatTest({
    ...TWO_PLANET_INVASION,
    attacker: {
      faction: 'ARBOREC',
      units: {},
      placements: { [SPACE_SURFACE_ID]: { DREADNOUGHT: 2, INFANTRY: 1 } },
      abilities: units ? { BOMBARDMENT: { units } } : {},
    },
    defender: {
      faction: 'ARBOREC',
      units: {},
      placements: { [PLANET_1]: { INFANTRY: 1 }, [PLANET_2]: { INFANTRY: 1 } },
    },
  })
}

describe('BOMBARDMENT', () => {
  it('bombards the first planet with every unit by default', () => {
    const t = invasion()

    t.advanceTo('COMMIT_UNITS', { defender: 1 })

    const pools = bombardmentPools(t.log)
    expect(pools).toHaveLength(1)
    expect(pools[0].attacker).toContainDice('DREADNOUGHT', [5, 1], [5, 1])
    expect(getSurfaceUnitIds(t.state.defender, PLANET_1)).toHaveLength(0)
    expect(getSurfaceUnitIds(t.state.defender, PLANET_2)).toHaveLength(1)
  })

  it('splits bombarding units between planets', () => {
    const t = invasion([
      [at('DREADNOUGHT', PLANET_1), 1],
      [at('DREADNOUGHT', PLANET_2), 1],
    ])

    t.advanceTo('COMMIT_UNITS', { defender: 1 })

    const pools = bombardmentPools(t.log)
    expect(pools).toHaveLength(2)
    for (const pool of pools)
      expect(pool.attacker).toContainDice('DREADNOUGHT', [5, 1])
    expect(getSurfaceUnitIds(t.state.defender, PLANET_1)).toHaveLength(0)
    expect(getSurfaceUnitIds(t.state.defender, PLANET_2)).toHaveLength(0)
    // Commitment follows on the first planet.
    expect(t.state.activeSurfaceId).toBe(PLANET_1)
  })

  it('offers every bombarding unit on each planet, all on the first', () => {
    const setup = new CombatSetup('FULL')
    setup.setCombatMode('GROUND')
    setup.addPlanet()
    setup.setSurfaceUnitCount('attacker', SPACE_SURFACE_ID, 'DREADNOUGHT', 2)
    setup.setSurfaceUnitCount('attacker', SPACE_SURFACE_ID, 'CRUISER', 1)
    setup.setSurfaceUnitCount('defender', PLANET_1, 'INFANTRY', 1)
    setup.setSurfaceUnitCount('defender', PLANET_2, 'INFANTRY', 1)

    expect(
      setupOptions(setup, 'BOMBARDMENT', 'units').map(item => [
        item.value,
        item.max,
      ]),
    ).toEqual([
      [at('DREADNOUGHT', PLANET_1), 2],
      [at('DREADNOUGHT', PLANET_2), 2],
    ])
    expect(setup.abilities.attacker.BOMBARDMENT.units).toEqual([
      [at('DREADNOUGHT', PLANET_1), 2],
      [at('DREADNOUGHT', PLANET_2), 0],
    ])
  })
})
