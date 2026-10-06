import { describe, expect, it } from 'vitest'

import { SPACE_SURFACE_ID } from '@/types'

import { combatTest } from '../utils/combat-test'
import { PLANET_1, PLANET_2, TWO_PLANET_INVASION } from '../utils/surface-units'

describe('ANNIHILATOR + HARROW', () => {
  it('mech does NOT bombard under Harrow (committed to ground combat)', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'L1Z1X_MINDNET',
        units: { DREADNOUGHT: 1, MECH: 1, INFANTRY: 1 },
        abilities: { HARROW: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
      },
    })

    t.advanceToTiming(
      'END_OF_COMBAT_ROUND',
      { attacker: 0, defender: 0 },
      'GROUND_COMBAT',
    )
    t.advanceRound({ attacker: 0, defender: 0 })

    // Last DICE_POOL is Harrow's resolveStep BOMBARDMENT. The mech is now
    // participating in ground combat, so Annihilator's cannotBeUsed
    // restriction keeps it out — dreadnought is the only contributor.
    const pool = t.dicePool()
    expect(pool.hitSource).toBe('BOMBARDMENT')
    expect(pool.attacker).toContainDice('DREADNOUGHT', [5, 1])
    expect(pool.attacker).not.toContainDice('MECH')
  })

  it('mech on another planet bombards under Harrow', () => {
    const t = combatTest({
      ...TWO_PLANET_INVASION,
      attacker: {
        faction: 'L1Z1X_MINDNET',
        units: {},
        placements: {
          [SPACE_SURFACE_ID]: { DREADNOUGHT: 1, INFANTRY: 1 },
          [PLANET_2]: { MECH: 1 },
        },
        abilities: { HARROW: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: {},
        placements: {
          [PLANET_1]: { INFANTRY: 3 },
          [PLANET_2]: { INFANTRY: 1 },
        },
      },
    })

    t.advanceToTiming(
      'END_OF_COMBAT_ROUND',
      { attacker: 0, defender: 0 },
      'GROUND_COMBAT',
    )
    t.advanceRound({ attacker: 0, defender: 0 })

    // Planet 1's combat: the mech on planet 2 isn't participating.
    const pool = t.dicePool()
    expect(t.state.activeSurfaceId).toBe(PLANET_1)
    expect(pool.hitSource).toBe('BOMBARDMENT')
    expect(pool.attacker).toContainDice('MECH', [8, 1])
  })
})
