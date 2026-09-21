import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

/**
 * Engine test: winning SPACE combat requires space-combat participants.
 * A side whose only remaining units merely share the area (ferried ground
 * forces, structures) cannot take the win when the opponent is absent or
 * wiped in a unit-ability phase — the combat ends with no winner instead.
 * Ship-mechs (Eidolon Maximum) participate and therefore still win.
 */
describe('space combat winner requires participating units', () => {
  it('ground forces alone do not win against an empty opponent', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { INFANTRY: 2 } },
      defender: { faction: 'ARBOREC', units: {} },
    })

    t.advanceTo('COMPLETE')

    expect(t.state.winnerSide).toBe('draw')
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
  })

  it('ships win against an empty opponent', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      defender: { faction: 'ARBOREC', units: {} },
    })

    t.advanceTo('COMPLETE')

    expect(t.state.winnerSide).toBe('attacker')
  })

  it('a defender left with only ground forces does not win either', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: {} },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1, MECH: 1 } },
    })

    t.advanceTo('COMPLETE')

    expect(t.state.winnerSide).toBe('draw')
  })

  it('structures alone do not take the win when space cannon wipes the fleet', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { FIGHTER: 1 } },
      defender: { faction: 'ARBOREC', units: { PDS: 2 } },
    })

    // SCO branch where the lone fighter dies: the defender holds only PDS,
    // which cannot fight (or win) a space combat.
    t.advanceTo('COMPLETE', { attacker: 1 })

    expect(t.attacker.units.FIGHTER).toBeUndefined()
    expect(t.state.winnerSide).toBe('draw')
  })

  it('Eidolon Maximum mechs are ships and do win against an empty opponent', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { MECH: 2 },
        abilities: { EIDOLON_MAXIMUM: true },
      },
      defender: { faction: 'ARBOREC', units: {} },
    })

    t.advanceTo('COMPLETE')

    expect(t.state.winnerSide).toBe('attacker')
  })

  it('base Z-Grav Eidolon mechs cannot bootstrap space combat', () => {
    // The transform fires at START_OF_COMBAT. With no native ship on its
    // side, combat never starts and the mechs never become ships.
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'NAAZ_ROKHA_ALLIANCE', units: { MECH: 2 } },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('COMPLETE')

    expect(t.abilityLog('EIDOLON')).toHaveLength(0)
    expect(t.state.winnerSide).toBe('defender')
  })

  it('combat-round wipes are unaffected: surviving ships still win over ferried infantry', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1, INFANTRY: 2 } },
      defender: { faction: 'ARBOREC', units: { DREADNOUGHT: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.CRUISER).toBeUndefined()
    expect(t.state.winnerSide).toBe('defender')
    // The infantry survive but grant no win.
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
  })
})
