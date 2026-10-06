import { describe, expect, it } from 'vitest'

import { makeUnitLocator, makeVariantId } from '@/combat'
import { GALVANIZED } from '@/data/main/abilities/general/pre-galvanized'
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
const GALVANIZED_INFANTRY = makeVariantId('INFANTRY', [GALVANIZED])

function setupWithGalvanized(count: number) {
  const setup = new CombatSetup('FULL')
  setup.setCombatMode('GROUND')
  setup.addPlanet()
  setup.setSurfaceUnitCount('attacker', SPACE_SURFACE_ID, 'INFANTRY', 10)
  setup.setSurfaceUnitCount('defender', PLANET_1, 'INFANTRY', 1)
  setup.setSurfaceUnitCount('defender', PLANET_2, 'INFANTRY', 1)
  setAbility(setup, 'attacker', 'PRE_GALVANIZED', {
    isEnabled: true,
    galvanizedUnits: [[at('INFANTRY', SPACE_SURFACE_ID), count]],
  })
  return setup
}

describe('COMMIT_GROUND_FORCES + PRE_GALVANIZED', () => {
  it('offers galvanized units apart from the normal ones', () => {
    const setup = setupWithGalvanized(5)

    expect(
      setupOptions(setup, 'COMMIT_GROUND_FORCES', 'units').map(item => [
        item.value,
        item.max,
      ]),
    ).toEqual([
      [at('INFANTRY', PLANET_1), 5],
      [at('INFANTRY', PLANET_2), 5],
      [at('INFANTRY', SPACE_SURFACE_ID), 5],
      [at(GALVANIZED_INFANTRY, PLANET_1), 5],
      [at(GALVANIZED_INFANTRY, PLANET_2), 5],
      [at(GALVANIZED_INFANTRY, SPACE_SURFACE_ID), 5],
    ])
    expect(setup.abilities.attacker.COMMIT_GROUND_FORCES.units).toEqual(
      expect.arrayContaining([
        [at('INFANTRY', PLANET_1), 5],
        [at(GALVANIZED_INFANTRY, PLANET_1), 5],
      ]),
    )
  })

  it('rebalances the split when the galvanized count changes', () => {
    const setup = setupWithGalvanized(5)
    setAbility(setup, 'attacker', 'PRE_GALVANIZED', {
      galvanizedUnits: [[at('INFANTRY', SPACE_SURFACE_ID), 3]],
    })

    const units = new Map(
      setup.abilities.attacker.COMMIT_GROUND_FORCES.units as [string, number][],
    )
    expect(units.get(at('INFANTRY', PLANET_1))).toBe(7)
    expect(units.get(at(GALVANIZED_INFANTRY, PLANET_1))).toBe(3)
  })

  it('lands the galvanized units where the split sends them', () => {
    const t = combatTest({
      ...TWO_PLANET_INVASION,
      attacker: {
        faction: 'ARBOREC',
        units: {},
        placements: { [SPACE_SURFACE_ID]: { INFANTRY: 4 } },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [[at('INFANTRY', SPACE_SURFACE_ID), 2]],
          },
          COMMIT_GROUND_FORCES: {
            units: [
              [at('INFANTRY', PLANET_1), 2],
              [at(GALVANIZED_INFANTRY, PLANET_2), 1],
              [at(GALVANIZED_INFANTRY, SPACE_SURFACE_ID), 1],
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

    const types = (surface: typeof PLANET_1) =>
      getSurfaceUnitIds(t.state.attacker, surface).map(
        id => t.state.attacker.unitType[id],
      )
    expect(types(PLANET_1)).toEqual(['INFANTRY', 'INFANTRY'])
    expect(types(PLANET_2)).toEqual([GALVANIZED_INFANTRY])
    expect(types(SPACE_SURFACE_ID)).toEqual([GALVANIZED_INFANTRY])
  })

  it('fills a galvanized count with normal units when too few are galvanized', () => {
    const t = combatTest({
      ...TWO_PLANET_INVASION,
      attacker: {
        faction: 'ARBOREC',
        units: {},
        placements: { [SPACE_SURFACE_ID]: { INFANTRY: 3 } },
        abilities: {
          COMMIT_GROUND_FORCES: {
            units: [[at(GALVANIZED_INFANTRY, PLANET_2), 2]],
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

    expect(getSurfaceUnitIds(t.state.attacker, PLANET_1)).toHaveLength(1)
    expect(getSurfaceUnitIds(t.state.attacker, PLANET_2)).toHaveLength(2)
  })
})
