import { describe, expect, it } from 'vitest'

import { makeUnitLocator } from '@/combat'
import { UNIT_LIMITS } from '@/constants/units'
import { CombatSetup } from '@/hooks/combat-setup'
import { SPACE_SURFACE_ID } from '@/types'

import { combatTest } from '../utils/combat-test'
import { hitOrderUnits, setAbility } from '../utils/setup-options'

describe.forEachSide('SLEEPER_CELL', () => {
  it('places a copy of each destroyed opponent ship', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { CRUISER: 3 },
        abilities: { SLEEPER_CELL: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // Defender receives 1 hit → 1 cruiser destroyed
    t.advanceRound({ defender: 1 })

    // START_OF_COMBAT activation + AFTER_DESTROY placement
    expect(t.abilityLog('SLEEPER_CELL')).not.toHaveLength(0)
    // Attacker: 3 original + 1 copied = 4
    expect(t.attacker.units.CRUISER).toHaveLength(4)
  })

  it('places copies of multiple destroyed ship types', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { CRUISER: 3 },
        abilities: { SLEEPER_CELL: true },
      },
      defender: {
        faction: 'ARBOREC',
        // No destroyers (AFB causes extra branching)
        units: { CRUISER: 1, FIGHTER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // Defender receives 2 hits → both cruiser and fighter destroyed
    t.advanceRound({ defender: 2 })

    expect(t.defender.units.CRUISER).toBeUndefined()
    expect(t.defender.units.FIGHTER).toBeUndefined()
    // Attacker gains 1 cruiser + 1 fighter
    expect(t.attacker.units.CRUISER).toHaveLength(4) // 3 + 1
    expect(t.attacker.units.FIGHTER).toHaveLength(1)
  })

  it('enforces fleet pool limit by removing lowest priority non-fighter ships', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        // 2 cruisers + 1 carrier = 3 non-fighter ships, fleetPool: 3
        units: { CRUISER: 2, CARRIER: 1, FIGHTER: 2 },
        abilities: {
          SLEEPER_CELL: true,
          FLEET_POOL: {
            isEnabled: true,
            fleetPool: 3,
            // Keep cruisers over carriers
            shipPriority: [['CRUISER'], ['CARRIER']],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // Defender receives 1 hit → 1 cruiser destroyed
    // Attacker gains 1 cruiser → 3 cruisers + 1 carrier = 4 non-fighters → excess 1
    // Fighters not counted, not removed
    // Remove lowest priority non-fighter (CARRIER) first
    t.advanceRound({ defender: 1 })

    expect(t.attacker.units.CRUISER).toHaveLength(3) // 2 + 1 gained
    expect(t.attacker.units.CARRIER).toBeUndefined() // removed (lowest priority)
    expect(t.attacker.units.FIGHTER).toHaveLength(2) // untouched
  })

  it('respects unit limits when placing copies', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        // Cruiser limit is 8; attacker has 7
        units: { CRUISER: 7 },
        abilities: {
          SLEEPER_CELL: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // Defender receives 2 hits → 2 cruisers destroyed
    // Attacker has 7 cruisers, limit 8 → can only place 1
    t.advanceRound({ defender: 2 })

    expect(t.attacker.units.CRUISER).toHaveLength(8) // 7 + 1 (not 7 + 2)
  })

  it('works across multiple rounds', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { CRUISER: 2 },
        abilities: {
          SLEEPER_CELL: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // Round 1: defender loses 1 cruiser
    t.advanceRound({ defender: 1 })
    expect(t.attacker.units.CRUISER).toHaveLength(3) // 2 + 1

    // Round 2: defender loses 1 more cruiser
    t.advanceRound({ defender: 1 })
    expect(t.attacker.units.CRUISER).toHaveLength(4) // 3 + 1
  })

  it('does not place ships when no reinforcements are available', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { CRUISER: 2 },
        abilities: {
          SLEEPER_CELL: {
            isEnabled: true,
            availableShips: [['CRUISER', 0]],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 1 })

    // No CRUISER reinforcements → nothing placed
    expect(t.attacker.units.CRUISER).toHaveLength(2)
  })

  it('caps placement by availableShips even when board limit allows more', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { CRUISER: 2 },
        abilities: {
          SLEEPER_CELL: {
            isEnabled: true,
            availableShips: [['CRUISER', 1]],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // Defender loses 2 cruisers, but only 1 reinforcement is available
    t.advanceRound({ defender: 2 })

    expect(t.attacker.units.CRUISER).toHaveLength(3) // 2 + 1 (not 2 + 2)
  })

  it('decrements availableShips after placing copies', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { CRUISER: 2 },
        abilities: {
          SLEEPER_CELL: {
            isEnabled: true,
            availableShips: [['CRUISER', 2]],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 1 })

    expect(t.attacker.units.CRUISER).toHaveLength(3) // 2 + 1
    const availableShips =
      t.state.attacker.abilities.SLEEPER_CELL?.availableShips
    expect(availableShips).toContainEqual(['CRUISER', 1])
  })

  it('refunds availableShips when own ships are destroyed', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { CRUISER: 2 },
        abilities: {
          SLEEPER_CELL: {
            isEnabled: true,
            availableShips: [['CRUISER', 0]],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 4 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // Attacker loses 1 cruiser → reinforcements should refund to 1
    t.advanceRound({ attacker: 1 })

    const availableShips =
      t.state.attacker.abilities.SLEEPER_CELL?.availableShips
    expect(availableShips).toContainEqual(['CRUISER', 1])
  })

  it('clamps availableShips entries to remaining reinforcement headroom (EXTRA)', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { CRUISER: 2 },
        abilities: {
          SLEEPER_CELL: {
            isEnabled: true,
            // EXTRA cap = UNIT_LIMITS.CRUISER - 2 in combat = 6.
            availableShips: [['CRUISER', 99]],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')

    const availableShips =
      t.state.attacker.abilities.SLEEPER_CELL?.availableShips
    expect(availableShips).toContainEqual(['CRUISER', UNIT_LIMITS.CRUISER - 2])
  })

  it("declares the opponent's ship types for the hit order", () => {
    const setup = new CombatSetup()
    setup.setFaction('attacker', 'MENTAK_COALITION')
    setup.setUnitCount('attacker', 'CRUISER', 1)
    setup.setUnitCount('defender', 'DREADNOUGHT', 1)
    const dreadnought = makeUnitLocator('DREADNOUGHT', SPACE_SURFACE_ID)
    expect(hitOrderUnits(setup, 'SPACE')).not.toContain(dreadnought)

    setAbility(setup, 'attacker', 'SLEEPER_CELL', { isEnabled: true })
    expect(hitOrderUnits(setup, 'SPACE')).toContain(dreadnought)
    expect(hitOrderUnits(setup, 'SPACE')).not.toContain(
      makeUnitLocator('CARRIER', SPACE_SURFACE_ID),
    )
  })
})
