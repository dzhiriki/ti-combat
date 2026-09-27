import { describe, expect, it } from 'vitest'

import { isUnitCategory } from '@/combat/utils/unit-combat-properties'
import { DEFAULT_PLANET_ID, SPACE_SURFACE_ID } from '@/types'

import { combatTest, unitsByBaseType } from '../utils/combat-test'

describe.forEachSide('EIDOLON', () => {
  it('mech participates in space combat with [8, 2] stats', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { CRUISER: 1, MECH: 1 },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // Mech Z-Grav form: [8, 2]
    expect(pool.attacker).toContainDice('MECH', [8, 2])
  })

  it('multiple mechs all get [8, 2] stats', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { CRUISER: 1, MECH: 3 },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // Each mech rolls [8, 2] — 3 mechs = 3 groups of [8, 2]
    const mechDice = pool.attacker.MECH!
    expect(mechDice).toHaveLength(3)
    for (const group of mechDice) {
      expect(group[0]).toBe(8)
      expect(group[1]).toBe(2)
    }
  })

  it('only mechs in the space area become ships', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: {},
        placements: {
          [SPACE_SURFACE_ID]: { CRUISER: 1, MECH: 1 },
          [DEFAULT_PLANET_ID]: { MECH: 1 },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    // The card flips for every mech, but the one on the planet is no ship.
    expect(t.dicePool().attacker.MECH).toEqual([[8, 2]])
    const side = t.state.attacker
    for (const id of unitsByBaseType(side).MECH!) {
      const inSpace = side.unitSurface[id] === SPACE_SURFACE_ID
      expect(isUnitCategory(side, id, 'SHIPS')).toBe(inSpace)
      expect(side.participatingUnits.includes(id)).toBe(inSpace)
    }
  })

  it('mech is a valid hit target in space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { CRUISER: 1, MECH: 1 },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 2 })

    expect(t.attacker.units.MECH).toBeUndefined()
    expect(t.attacker.units.CRUISER).toBeUndefined()
  })

  it('mech cannot sustain damage in space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { CRUISER: 1, MECH: 1 },
        abilities: {
          SUSTAIN_DAMAGE: {
            spacePriority: [['MECH', true]],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1 })

    // Mech should NOT sustain
    expect(t.attacker.units.MECH![0].isDamaged).toBeFalsy()
  })

  it('mech has normal [6, 2] with sustain in ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { MECH: 1, INFANTRY: 1 },
        abilities: {
          SUSTAIN_DAMAGE: {
            groundPriority: [['MECH', true]],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    // Eidolon has context: 'SPACE' so it doesn't fire in ground combat
    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ attacker: 1 })
    const pool = t.dicePool()

    // Mech normal stats: [6, 2]
    expect(pool.attacker).toContainDice('MECH', [6, 2])

    // Sustain should work in ground combat
    expect(t.attacker.units.MECH![0].isDamaged).toBe(true)
  })
})
