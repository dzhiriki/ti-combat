import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('CAPACITY', () => {
  it('removes all carried units when capacity ships destroyed during SCO', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        // Carrier is the only valid SCO target (infantry aren't ships)
        units: { CARRIER: 1, INFANTRY: 3 },
        abilities: { CAPACITY: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, PDS: 1 },
      },
    })

    // SCO hits carrier (only ship target) → capacity 0 → all infantry removed
    t.advanceTo('SPACE_COMBAT', { attacker: 1 })

    expect(t.attacker.units.CARRIER).toBeUndefined()
    expect(t.attacker.units.INFANTRY).toBeUndefined()
  })

  it('removes carried units when only ships without capacity survive SCO', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        // Carrier is the only capacity source; cruiser has none
        units: { CARRIER: 1, CRUISER: 1, INFANTRY: 3 },
        abilities: {
          CAPACITY: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, PDS: 1 },
        abilities: {
          SPACE_CANNON_OFFENSE: {
            customPriority: true,
            unitPriority: [['CARRIER'], ['CRUISER'], ['INFANTRY']],
          },
        },
      },
    })

    // SCO hits carrier (first in SCO priority) → cruiser survives but has no capacity
    t.advanceTo('SPACE_COMBAT', { attacker: 1 })

    expect(t.attacker.units.CARRIER).toBeUndefined()
    expect(t.attacker.units.CRUISER).toHaveLength(1)
    expect(t.attacker.units.INFANTRY).toBeUndefined()
  })

  it('removes excess carried units by priority after SCO', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        // Carrier(cap 4) + 5 carried units → excess = 1
        units: { CARRIER: 1, FIGHTER: 3, INFANTRY: 2 },
        abilities: { CAPACITY: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    // No hits during SCO → capacity = 4, carried = 5
    // Default priority: MECH, INFANTRY, FIGHTER → remove 1 infantry
    t.advanceTo('SPACE_COMBAT')

    expect(t.attacker.units.FIGHTER).toHaveLength(2)
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
  })

  it('enforces capacity at PREPARE and does not remove when within', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        // Carrier(cap 4) + 6 fighters → excess 2 removed at PREPARE
        units: { CARRIER: 1, FIGHTER: 6 },
        abilities: { CAPACITY: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    // PREPARE already ran (combatTest constructor) → 4 fighters remain
    expect(t.attacker.units.FIGHTER).toHaveLength(4)
  })

  it('removes carried units after space combat ends', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        // Carrier provides 4 cap. 2 fighters within capacity.
        units: { CARRIER: 1, FIGHTER: 2 },
        abilities: {
          CAPACITY: true,
          // Sacrifice carrier first so combat hit destroys it
          UNIT_PRIORITY: {
            spaceUnitPriority: [['CARRIER'], ['FIGHTER']],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    // No SCO damage, within capacity. Enter space combat.
    t.advanceTo('SPACE_COMBAT')
    expect(t.attacker.units.FIGHTER).toHaveLength(2)

    // Round 1: attacker receives 1 hit (carrier), defender receives 1 hit (cruiser dies)
    // END_OF_COMBAT fires → capacity = 0 → fighters removed
    t.advanceRound({ attacker: 1, defender: 1 })

    expect(t.attacker.units.CARRIER).toBeUndefined()
    expect(t.attacker.units.FIGHTER).toBeUndefined()
  })

  it('respects custom removal priority', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CARRIER: 1, FIGHTER: 3, INFANTRY: 2 },
        abilities: {
          CAPACITY: {
            isEnabled: true,
            removePriority: [['FIGHTER'], ['INFANTRY'], ['MECH']],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    // 5 carried units, 4 capacity → remove 1
    // Custom priority: fighters first → remove 1 fighter
    t.advanceTo('SPACE_COMBAT')

    expect(t.attacker.units.FIGHTER).toHaveLength(2)
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
  })

  it('does not enforce capacity when disabled', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, FIGHTER: 3 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    // Capacity disabled (default), cruiser has no capacity
    // Fighters should survive
    t.advanceTo('SPACE_COMBAT')

    expect(t.attacker.units.FIGHTER).toHaveLength(3)
  })

  it('does not count units with CAPACITY_COST: 0 against capacity', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARGENT_FLIGHT',
        // Carrier cap 4, 2 mechs (cost 0) + 4 fighters (cost 4) = 4 total
        units: { CARRIER: 1, MECH: 2, FIGHTER: 4 },
        abilities: { CAPACITY: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    // Argent mechs cost 0 → total cost = 4 (fighters only) = capacity
    // No excess → all units survive
    expect(t.attacker.units.MECH).toHaveLength(2)
    expect(t.attacker.units.FIGHTER).toHaveLength(4)
  })
})
