import { describe, expect, it } from 'vitest'

import { type DicePool, makeUnitLocator } from '@/combat'
import { SPACE_SURFACE_ID } from '@/types'

import { combatTest } from '../utils/combat-test'
import {
  getSurfaceUnitIds,
  PLANET_1,
  PLANET_2,
  TWO_PLANET_INVASION,
} from '../utils/surface-units'

const at = makeUnitLocator

describe('BOMBARDMENT + PLANETARY_SHIELD', () => {
  it('only the shielded planet escapes a split bombardment', () => {
    const t = combatTest({
      ...TWO_PLANET_INVASION,
      attacker: {
        faction: 'ARBOREC',
        units: {},
        placements: { [SPACE_SURFACE_ID]: { DREADNOUGHT: 2, INFANTRY: 1 } },
        abilities: {
          BOMBARDMENT: {
            units: [
              [at('DREADNOUGHT', PLANET_1), 1],
              [at('DREADNOUGHT', PLANET_2), 1],
            ],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: {},
        placements: {
          [PLANET_1]: { INFANTRY: 1 },
          [PLANET_2]: { INFANTRY: 1, PDS: 1 },
        },
        abilities: { SPACE_CANNON_DEFENSE: false },
      },
    })

    t.advanceTo('COMMIT_UNITS', { defender: 1 })

    const pools = t.log
      .filter(entry => entry.path.at(-1) === 'DICE_POOL')
      .map(entry => entry.data?.[0] as { attacker: DicePool })
      .filter(pool => pool.attacker.DREADNOUGHT)
    expect(pools).toHaveLength(1)
    expect(getSurfaceUnitIds(t.state.defender, PLANET_1)).toHaveLength(0)
    expect(getSurfaceUnitIds(t.state.defender, PLANET_2)).toHaveLength(2)
  })
})
