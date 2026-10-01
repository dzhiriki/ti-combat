import { describe, expect, it } from 'vitest'

import { makeUnitLocator } from '@/combat'
import { CombatSetup } from '@/hooks/combat-setup'
import { SPACE_SURFACE_ID } from '@/types'

import { combatTest } from '../utils/combat-test'
import { setAbility, setupOptions } from '../utils/setup-options'
import {
  getSurfaceUnitIds,
  PLANET_1,
  PLANET_2,
  TWO_PLANET_INVASION,
} from '../utils/surface-units'

const at = makeUnitLocator

function twoPlanetSetup() {
  const setup = new CombatSetup('FULL')
  setup.setCombatMode('GROUND')
  setup.addPlanet()
  setup.setSurfaceUnitCount('attacker', SPACE_SURFACE_ID, 'INFANTRY', 3)
  setup.setSurfaceUnitCount('attacker', SPACE_SURFACE_ID, 'MECH', 1)
  setup.setSurfaceUnitCount('defender', PLANET_1, 'INFANTRY', 1)
  setup.setSurfaceUnitCount('defender', PLANET_2, 'INFANTRY', 1)
  return setup
}

describe('COMMIT_GROUND_FORCES', () => {
  it('lands every ground force in space on the invaded planet by default', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: {},
        placements: { [SPACE_SURFACE_ID]: { INFANTRY: 2, MECH: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: {},
        placements: { [PLANET_1]: { INFANTRY: 1 } },
      },
    })

    t.advanceTo('GROUND_COMBAT')

    expect(getSurfaceUnitIds(t.state.attacker, PLANET_1)).toHaveLength(3)
    expect(getSurfaceUnitIds(t.state.attacker, SPACE_SURFACE_ID)).toHaveLength(
      0,
    )
  })

  it('splits units between planets and keeps some in space', () => {
    const t = combatTest({
      ...TWO_PLANET_INVASION,
      attacker: {
        faction: 'ARBOREC',
        units: {},
        placements: { [SPACE_SURFACE_ID]: { INFANTRY: 3 } },
        abilities: {
          COMMIT_GROUND_FORCES: {
            units: [
              [at('INFANTRY', PLANET_1), 1],
              [at('INFANTRY', PLANET_2), 1],
              [at('INFANTRY', SPACE_SURFACE_ID), 1],
            ],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: {},
        placements: {
          [PLANET_1]: { INFANTRY: 1 },
          [PLANET_2]: { INFANTRY: 1 },
        },
      },
    })

    t.advanceTo('GROUND_COMBAT')

    for (const surface of [PLANET_1, PLANET_2, SPACE_SURFACE_ID])
      expect(getSurfaceUnitIds(t.state.attacker, surface)).toHaveLength(1)
  })

  it('offers each ground force type on every invaded planet and in space', () => {
    const setup = twoPlanetSetup()
    const items = setupOptions(setup, 'COMMIT_GROUND_FORCES', 'units')

    expect(items.map(item => [item.value, item.max])).toEqual([
      [at('MECH', PLANET_1), 1],
      [at('MECH', PLANET_2), 1],
      [at('MECH', SPACE_SURFACE_ID), 1],
      [at('INFANTRY', PLANET_1), 3],
      [at('INFANTRY', PLANET_2), 3],
      [at('INFANTRY', SPACE_SURFACE_ID), 3],
    ])
    // Everything lands on the first planet until split.
    expect(setup.abilities.attacker.COMMIT_GROUND_FORCES.units).toEqual(
      expect.arrayContaining([
        [at('INFANTRY', PLANET_1), 3],
        [at('INFANTRY', PLANET_2), 0],
        [at('MECH', PLANET_1), 1],
      ]),
    )
  })

  it('keeps each split adding up to the units in space', () => {
    const setup = twoPlanetSetup()
    const infantry = () =>
      new Map(
        setup.abilities.attacker.COMMIT_GROUND_FORCES.units as [
          string,
          number,
        ][],
      )
    setAbility(setup, 'attacker', 'COMMIT_GROUND_FORCES', {
      units: [
        [at('INFANTRY', PLANET_1), 1],
        [at('INFANTRY', PLANET_2), 5],
        [at('INFANTRY', SPACE_SURFACE_ID), 1],
      ],
    })
    // Too many: space gives way first, then the last planet.
    expect(infantry().get(at('INFANTRY', PLANET_1))).toBe(1)
    expect(infantry().get(at('INFANTRY', PLANET_2))).toBe(2)
    expect(infantry().get(at('INFANTRY', SPACE_SURFACE_ID))).toBe(0)

    // A new unit lands on the first planet.
    setup.setSurfaceUnitCount('attacker', SPACE_SURFACE_ID, 'INFANTRY', 4)
    expect(infantry().get(at('INFANTRY', PLANET_1))).toBe(2)
    expect(infantry().get(at('INFANTRY', PLANET_2))).toBe(2)
  })
})
