import { describe, expect, it } from 'vitest'

import { makeUnitLocator } from '@/combat'
import { CombatSetup } from '@/hooks/combat-setup'
import { SPACE_SURFACE_ID } from '@/types'

import { combatTest } from '../utils/combat-test'
import { hitOrderUnits, setAbility } from '../utils/setup-options'

describe.forEachSide('OVERWING_ZETA', () => {
  it('places flagship and cruisers at start of combat (IMMEDIATELY)', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'COUNCIL_KELERES',
        units: { CRUISER: 1 },
        abilities: {
          OVERWING_ZETA: {
            isEnabled: true,
            ships: [
              ['FLAGSHIP', 1],
              ['CRUISER', 1],
            ],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')

    t.advanceRound()

    expect(t.abilityLog('OVERWING_ZETA')).not.toHaveLength(0)
    expect(t.attacker.units.FLAGSHIP).toHaveLength(1)
    // 1 original + 1 placed = 2
    expect(t.attacker.units.CRUISER).toHaveLength(2)
  })

  it('places destroyers alongside flagship', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'COUNCIL_KELERES',
        units: { CRUISER: 1 },
        abilities: {
          OVERWING_ZETA: {
            isEnabled: true,
            ships: [
              ['FLAGSHIP', 1],
              ['DESTROYER', 2],
            ],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')

    t.advanceRound()

    expect(t.attacker.units.FLAGSHIP).toHaveLength(1)
    expect(t.attacker.units.DESTROYER).toHaveLength(2)
    expect(t.attacker.units.CRUISER).toHaveLength(1)
  })

  it('clamps cruisers + destroyers to 2 total', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'COUNCIL_KELERES',
        units: { CRUISER: 1 },
        abilities: {
          OVERWING_ZETA: {
            isEnabled: true,
            ships: [
              ['CRUISER', 2],
              ['DESTROYER', 2],
            ],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')

    t.advanceRound()

    // Cruisers processed first, cap at 2 total → 2 cruisers, 0 destroyers
    expect(t.attacker.units.CRUISER).toHaveLength(3) // 1 original + 2 placed
    expect(t.attacker.units.DESTROYER).toBeUndefined()
  })

  it('does not fire when the ship counts are all zero', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'COUNCIL_KELERES',
        units: { CRUISER: 2 },
        abilities: {
          // The default is flagship 1 + cruisers 2 — zero it out explicitly.
          OVERWING_ZETA: {
            isEnabled: true,
            ships: [
              ['FLAGSHIP', 0],
              ['CRUISER', 0],
              ['DESTROYER', 0],
            ],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')

    t.advanceRound()

    expect(t.abilityLog('OVERWING_ZETA')).toHaveLength(0)
    expect(t.attacker.units.CRUISER).toHaveLength(2)
  })

  it('IMMEDIATELY enforces fleet pool by removing lowest priority ships', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'COUNCIL_KELERES',
        // 2 cruisers + 1 carrier = 3 non-fighter ships
        units: { CRUISER: 2, CARRIER: 1 },
        abilities: {
          OVERWING_ZETA: {
            isEnabled: true,
            ships: [
              ['FLAGSHIP', 1],
              ['DESTROYER', 1],
            ],
          },
          FLEET_POOL: {
            isEnabled: true,
            // 3 existing + 2 placed = 5, pool = 3 → 2 excess
            fleetPool: 3,
            shipPriority: [
              ['FLAGSHIP'],
              ['CRUISER'],
              ['DESTROYER'],
              ['CARRIER'],
            ],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')

    t.advanceRound()

    expect(t.attacker.units.FLAGSHIP).toHaveLength(1) // kept (highest priority)
    expect(t.attacker.units.CRUISER).toHaveLength(2) // kept (high priority)
    expect(t.attacker.units.DESTROYER).toBeUndefined() // removed (low priority)
    expect(t.attacker.units.CARRIER).toBeUndefined() // removed (lowest priority)
  })

  it('ENOUGH_FLEET_POOL waits until there is room', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'COUNCIL_KELERES',
        // 3 non-fighter ships, pool = 4, placing 2 → 5 > 4
        units: { CRUISER: 3 },
        abilities: {
          OVERWING_ZETA: {
            isEnabled: true,
            strategy: 'ENOUGH_FLEET_POOL',
            ships: [['CRUISER', 2]],
          },
          FLEET_POOL: {
            isEnabled: true,
            fleetPool: 4,
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT')

    // R1: 3 non-fighter + 2 to place = 5 > 4 fleet pool → doesn't fire
    // Attacker receives 2 hits → 1 cruiser remains
    t.advanceRound({ attacker: 2 })
    expect(t.abilityLog('OVERWING_ZETA')).toHaveLength(0)
    expect(t.attacker.units.CRUISER).toHaveLength(1)

    // R2: 1 non-fighter + 2 to place = 3 <= 4 fleet pool → fires
    t.advanceRound()
    expect(t.abilityLog('OVERWING_ZETA')).not.toHaveLength(0)
    expect(t.attacker.units.CRUISER).toHaveLength(3) // 1 + 2 placed
  })

  it('ENOUGH_FLEET_POOL does not fire when fleet stays full', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'COUNCIL_KELERES',
        // 3 non-fighter ships, pool = 3, placing 1 → 4 > 3
        units: { CRUISER: 3 },
        abilities: {
          OVERWING_ZETA: {
            isEnabled: true,
            strategy: 'ENOUGH_FLEET_POOL',
            ships: [['FLAGSHIP', 1]],
          },
          FLEET_POOL: {
            isEnabled: true,
            fleetPool: 3,
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    expect(t.abilityLog('OVERWING_ZETA')).toHaveLength(0)
  })

  it('declares its ships for the space hit order only', () => {
    const setup = new CombatSetup()
    setup.setFaction('attacker', 'COUNCIL_KELERES')
    setup.setUnitCount('attacker', 'CARRIER', 1)
    setAbility(setup, 'attacker', 'OVERWING_ZETA', { isEnabled: true })

    expect(hitOrderUnits(setup, 'SPACE')).toEqual(
      expect.arrayContaining([
        makeUnitLocator('FLAGSHIP', SPACE_SURFACE_ID),
        makeUnitLocator('CRUISER', SPACE_SURFACE_ID),
      ]),
    )
    expect(hitOrderUnits(setup, 'SPACE')).not.toContain(
      makeUnitLocator('DESTROYER', SPACE_SURFACE_ID),
    )
    // Ground combat never runs the card, so it places no ships on the planet.
    setup.setCombatMode('GROUND')
    expect(hitOrderUnits(setup, 'SPACE')).not.toContain(
      makeUnitLocator('FLAGSHIP', SPACE_SURFACE_ID),
    )
  })
})
