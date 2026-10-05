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

function setupWithGhom(inSpace: number, committed: number) {
  const setup = new CombatSetup('FULL')
  setup.setCombatMode('GROUND')
  setup.addPlanet()
  setup.setSurfaceUnitCount('attacker', SPACE_SURFACE_ID, 'INFANTRY', inSpace)
  setup.setSurfaceUnitCount('defender', PLANET_1, 'INFANTRY', 1)
  setup.setSurfaceUnitCount('defender', PLANET_2, 'INFANTRY', 1)
  setAbility(setup, 'attacker', 'GHOM_SEKKUS', { isEnabled: true })
  // Only plain infantry, as the panel edits the list.
  const units = setup.abilities.attacker.GHOM_SEKKUS.units as [string, number][]
  setAbility(setup, 'attacker', 'GHOM_SEKKUS', {
    units: units.map(([key]) => [key, key === 'INFANTRY' ? committed : 0]),
  })
  return setup
}

const offered = (setup: CombatSetup) =>
  setupOptions(setup, 'COMMIT_GROUND_FORCES', 'units').map(item => [
    item.value,
    item.max,
  ])

const split = (setup: CombatSetup) =>
  new Map(
    setup.abilities.attacker.COMMIT_GROUND_FORCES.units as [string, number][],
  )

describe('COMMIT_GROUND_FORCES + GHOM_SEKKUS', () => {
  it('splits the committed units with the ones in space', () => {
    const setup = setupWithGhom(10, 5)

    expect(offered(setup)).toEqual([
      [at('INFANTRY', PLANET_1), 15],
      [at('INFANTRY', PLANET_2), 15],
      [at('INFANTRY', SPACE_SURFACE_ID), 10],
    ])
    expect(split(setup).get(at('INFANTRY', PLANET_1))).toBe(15)
  })

  it('keeps no more units in space than stand there', () => {
    const setup = setupWithGhom(10, 5)
    setAbility(setup, 'attacker', 'COMMIT_GROUND_FORCES', {
      units: [
        [at('INFANTRY', PLANET_1), 0],
        [at('INFANTRY', PLANET_2), 0],
        [at('INFANTRY', SPACE_SURFACE_ID), 15],
      ],
    })

    expect(split(setup)).toEqual(
      new Map([
        [at('INFANTRY', PLANET_1), 5],
        [at('INFANTRY', PLANET_2), 0],
        [at('INFANTRY', SPACE_SURFACE_ID), 10],
      ]),
    )
  })

  it('offers no space share when no unit stands there', () => {
    const setup = setupWithGhom(0, 3)

    expect(offered(setup)).toEqual([
      [at('INFANTRY', PLANET_1), 3],
      [at('INFANTRY', PLANET_2), 3],
    ])
  })

  it('lands the committed units where the split sends them', () => {
    const t = combatTest({
      ...TWO_PLANET_INVASION,
      attacker: {
        faction: 'ARBOREC',
        units: {},
        placements: { [SPACE_SURFACE_ID]: { INFANTRY: 2 } },
        abilities: {
          GHOM_SEKKUS: {
            isEnabled: true,
            units: [
              ['INFANTRY', 3],
              ['MECH', 1],
            ],
          },
          COMMIT_GROUND_FORCES: {
            units: [
              [at('MECH', PLANET_1), 0],
              [at('MECH', PLANET_2), 1],
              [at('INFANTRY', PLANET_1), 3],
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

    t.advanceTo('SPACE_CANNON_DEFENSE')

    expect(getSurfaceUnitIds(t.state.attacker, PLANET_1)).toHaveLength(3)
    expect(getSurfaceUnitIds(t.state.attacker, PLANET_2)).toHaveLength(2)
    expect(getSurfaceUnitIds(t.state.attacker, SPACE_SURFACE_ID)).toHaveLength(
      1,
    )
  })

  it('lands the committed units before keeping any in space', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: {},
        placements: { [SPACE_SURFACE_ID]: { MECH: 1 } },
        abilities: {
          PRE_DAMAGED: { damagedUnits: [[at('MECH', SPACE_SURFACE_ID), 1]] },
          GHOM_SEKKUS: { isEnabled: true, units: [['MECH', 1]] },
          COMMIT_GROUND_FORCES: {
            units: [
              [at('MECH', PLANET_1), 1],
              [at('MECH', SPACE_SURFACE_ID), 1],
            ],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: {},
        placements: { [PLANET_1]: { INFANTRY: 1 } },
      },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE')

    const isDamaged = (surface: typeof PLANET_1) =>
      getSurfaceUnitIds(t.state.attacker, surface).map(
        id => !!t.state.attacker.unitState[id]?.isDamaged,
      )
    // The damaged mech stood in space; the committed one is fresh.
    expect(isDamaged(PLANET_1)).toEqual([false])
    expect(isDamaged(SPACE_SURFACE_ID)).toEqual([true])
  })
})
