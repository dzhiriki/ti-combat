import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

// A Strangled Whisper (Sickening Lurch flagship): "This ship can transport
// any number of infantry and fighters, and they do not count against this
// ship's capacity." Modeled as FREE_CARGO on the flagship stats — infantry
// and fighters ride free while it lives; mechs still pay into the printed
// capacity of 1.
describe.forEachSide('A Strangled Whisper', () => {
  it('carries any number of fighters while the flagship is fielded', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'SICKENING_LURCH',
        units: { FLAGSHIP: 1, FIGHTER: 5 },
        abilities: { CAPACITY: true },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    expect(t.attacker.units.FIGHTER).toHaveLength(5)
  })

  it('mechs still count against capacity — only infantry and fighters are free', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'SICKENING_LURCH',
        // Capacity 1: two mechs cost 1 each → one is removed; the fighters
        // ride free alongside.
        units: { FLAGSHIP: 1, MECH: 2, FIGHTER: 3 },
        abilities: { CAPACITY: true },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    expect(t.attacker.units.MECH).toHaveLength(1)
    expect(t.attacker.units.FIGHTER).toHaveLength(3)
  })

  it('capacity is enforced again once the flagship dies', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'SICKENING_LURCH',
        // Carrier capacity 4 — the 5th fighter only rides on the flagship.
        units: { FLAGSHIP: 1, CARRIER: 1, FIGHTER: 5 },
        abilities: {
          CAPACITY: true,
          // Sacrifice the flagship first so it dies mid-combat.
          UNIT_PRIORITY: {
            spaceUnitPriority: [['FLAGSHIP'], ['FIGHTER'], ['CARRIER']],
          },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    // Flagship sustains then dies; both defender cruisers die → combat ends.
    t.advanceRound({ attacker: 2, defender: 2 })

    expect(t.isFinished()).toBe(true)
    expect(t.attacker.units.FLAGSHIP).toBeUndefined()
    // End-of-combat capacity cleanup: 5 fighters no longer fit into the
    // carrier's 4 — one is removed.
    expect(t.attacker.units.FIGHTER).toHaveLength(4)
  })
})
