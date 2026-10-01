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

describe('COMMIT_GROUND_FORCES + MATRIARCH', () => {
  it('offers fighters to split once Matriarch commits them', () => {
    const setup = new CombatSetup('FULL')
    setup.setFaction('attacker', 'NAALU_COLLECTIVE')
    setup.setCombatMode('GROUND')
    setup.setSurfaceUnitCount('attacker', SPACE_SURFACE_ID, 'FLAGSHIP', 1)
    setup.setSurfaceUnitCount('attacker', SPACE_SURFACE_ID, 'FIGHTER', 4)
    setup.setSurfaceUnitCount('defender', PLANET_1, 'INFANTRY', 1)

    expect(
      setupOptions(setup, 'COMMIT_GROUND_FORCES', 'units').map(
        item => item.value,
      ),
    ).toEqual([at('FIGHTER', PLANET_1), at('FIGHTER', SPACE_SURFACE_ID)])
  })

  it('keeps offering infantry when Matriarch is toggled', () => {
    const setup = new CombatSetup('FULL')
    setup.setFaction('attacker', 'NAALU_COLLECTIVE')
    setup.setCombatMode('GROUND')
    setup.setSurfaceUnitCount('attacker', SPACE_SURFACE_ID, 'FLAGSHIP', 1)
    setup.setSurfaceUnitCount('attacker', SPACE_SURFACE_ID, 'FIGHTER', 4)
    setup.setSurfaceUnitCount('attacker', SPACE_SURFACE_ID, 'INFANTRY', 2)
    setup.setSurfaceUnitCount('defender', PLANET_1, 'INFANTRY', 1)
    const offered = () =>
      setupOptions(setup, 'COMMIT_GROUND_FORCES', 'units').map(
        item => item.value,
      )
    const infantry = [
      at('INFANTRY', PLANET_1),
      at('INFANTRY', SPACE_SURFACE_ID),
    ]
    const fighters = [at('FIGHTER', PLANET_1), at('FIGHTER', SPACE_SURFACE_ID)]

    setAbility(setup, 'attacker', 'MATRIARCH', { isEnabled: false })
    expect(offered()).toEqual(infantry)

    setAbility(setup, 'attacker', 'MATRIARCH', { isEnabled: true })
    expect(offered()).toEqual([...fighters, ...infantry])
  })

  it('splits committed fighters between planets and space', () => {
    const t = combatTest({
      ...TWO_PLANET_INVASION,
      attacker: {
        faction: 'NAALU_COLLECTIVE',
        units: {},
        placements: { [SPACE_SURFACE_ID]: { FLAGSHIP: 1, FIGHTER: 4 } },
        abilities: {
          COMMIT_GROUND_FORCES: {
            units: [
              [at('FIGHTER', PLANET_1), 1],
              [at('FIGHTER', PLANET_2), 2],
              [at('FIGHTER', SPACE_SURFACE_ID), 1],
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

    expect(getSurfaceUnitIds(t.state.attacker, PLANET_1)).toHaveLength(1)
    expect(getSurfaceUnitIds(t.state.attacker, PLANET_2)).toHaveLength(2)
    // The flagship and the fighter kept back.
    expect(getSurfaceUnitIds(t.state.attacker, SPACE_SURFACE_ID)).toHaveLength(
      2,
    )
  })
})
