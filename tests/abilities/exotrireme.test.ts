import { describe, expect, it } from 'vitest'

import { parseUnitLocator } from '@/combat/utils/parse-unit-locator'
import { CombatSetup } from '@/hooks/combat-setup'
import type { UnitList } from '@/types'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('EXOTRIREME', () => {
  it('sacrifices the dreadnought and destroys up to 2 opponent ships', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        upgrades: ['DREADNOUGHT'],
        abilities: { EXOTRIREME: { isEnabled: true, uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    expect(t.attacker.units.DREADNOUGHT).toBeUndefined()
    expect(t.defender.units.CRUISER).toHaveLength(1)
    expect(t.abilityLog('EXOTRIREME')).not.toHaveLength(0)
  })

  it('is on by default: setting its uses is enough', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        upgrades: ['DREADNOUGHT'],
        abilities: { EXOTRIREME: { uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 0, defender: 0 })

    expect(t.attacker.units.DREADNOUGHT).toBeUndefined()
    expect(t.defender.units.CRUISER).toHaveLength(1)
  })

  it('lists dreadnoughts for sacrifice before they are upgraded', () => {
    const setup = new CombatSetup()
    setup.setFaction('attacker', 'SARDAKK_NORR')

    const { sacrificePriority } = setup.abilities.attacker.EXOTRIREME as {
      sacrificePriority: UnitList<boolean>
    }

    expect(
      sacrificePriority.map(([key]) => parseUnitLocator(key).unitType),
    ).toEqual(['DREADNOUGHT'])
  })

  it('destroys only 1 ship when only 1 target remains', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        upgrades: ['DREADNOUGHT'],
        abilities: { EXOTRIREME: { isEnabled: true, uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    expect(t.attacker.units.DREADNOUGHT).toBeUndefined()
    expect(t.defender.units.CRUISER).toBeUndefined()
    expect(t.abilityLog('EXOTRIREME')).not.toHaveLength(0)
  })

  it('does not fire with default params — uses starts at 0 (opt-in)', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        upgrades: ['DREADNOUGHT'],
        abilities: { EXOTRIREME: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 0, defender: 0 })

    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
    expect(t.defender.units.CRUISER).toHaveLength(3)
    expect(t.abilityLog('EXOTRIREME')).toHaveLength(0)
  })

  it('uses cap limits sacrifices even with more dreadnoughts', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { DREADNOUGHT: 2, CRUISER: 1 },
        upgrades: ['DREADNOUGHT'],
        abilities: { EXOTRIREME: { isEnabled: true, uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 5 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 0, defender: 0 })

    // Only one dreadnought sacrifices (2 cruisers destroyed); the second
    // is gated by the exhausted uses.
    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
    expect(t.defender.units.CRUISER).toHaveLength(3)
  })

  it('does not fire when no valid targets remain', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        upgrades: ['DREADNOUGHT'],
        abilities: { EXOTRIREME: { isEnabled: true, uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    // Defender cruiser dies in round 1 from combat hits → no targets at round end
    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 1 })

    // Defender is wiped; Exotrireme II cannot fire because nothing to target
    expect(t.defender.units.CRUISER).toBeUndefined()
    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
    expect(t.abilityLog('EXOTRIREME')).toHaveLength(0)
  })

  it('fires once per Exotrireme II dreadnought', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { DREADNOUGHT: 2, CRUISER: 1 },
        upgrades: ['DREADNOUGHT'],
        abilities: { EXOTRIREME: { isEnabled: true, uses: 2 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 5 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    // Both dreadnoughts sacrifice, each destroying 2 cruisers (4 total)
    expect(t.attacker.units.DREADNOUGHT).toBeUndefined()
    expect(t.defender.units.CRUISER).toHaveLength(1)
  })

  it('fires each round while Exotrireme IIs and targets remain', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { DREADNOUGHT: 2, CRUISER: 2 },
        upgrades: ['DREADNOUGHT'],
        abilities: { EXOTRIREME: { isEnabled: true, uses: 2 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CARRIER: 1, CRUISER: 5 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound() // both dreads sacrifice → 4 opponent ships destroyed

    expect(t.attacker.units.DREADNOUGHT).toBeUndefined()
    expect(t.abilityLog('EXOTRIREME')).not.toHaveLength(0)
  })

  it('does not fire in ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { INFANTRY: 2 },
        upgrades: ['DREADNOUGHT'],
        abilities: { EXOTRIREME: { isEnabled: true, uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    expect(t.abilityLog('EXOTRIREME')).toHaveLength(0)
  })

  it('does not fire without the dreadnought upgrade', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        abilities: { EXOTRIREME: { isEnabled: true, uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    // Exotrireme I (base) has no ability attached
    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
    expect(t.defender.units.CRUISER).toHaveLength(3)
    expect(t.abilityLog('EXOTRIREME')).toHaveLength(0)
  })
})
