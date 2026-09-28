import { describe, expect, it } from 'vitest'

import { makeUnitLocator } from '@/combat'
import { CombatSetup } from '@/hooks/combat-setup'
import { DEFAULT_PLANET_ID, SPACE_SURFACE_ID } from '@/types'

import { combatTest } from '../utils/combat-test'
import { hitOrderUnits, setAbility } from '../utils/setup-options'

describe.forEachSide('BROTHER_MILOR', () => {
  it('places 2 fighters when own ship is destroyed in space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, FIGHTER: 1 },
        abilities: { BROTHER_MILOR: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // Attacker receives 1 hit — fighter destroyed, Brother Milor places 2 fighters
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.FIGHTER).toHaveLength(2) // 0 (destroyed) + 2 (placed)
    expect(t.abilityLog('BROTHER_MILOR')).not.toHaveLength(0)
  })

  it('places 2 infantry when own ground force is destroyed in ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: { BROTHER_MILOR: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    // Attacker receives 1 hit — 1 infantry destroyed, Brother Milor adds 2
    t.advanceRound({ attacker: 1 })

    // 2 - 1 (destroyed) + 2 (placed) = 3
    expect(t.attacker.units.INFANTRY).toHaveLength(3)
    expect(t.abilityLog('BROTHER_MILOR')).not.toHaveLength(0)
  })

  it('does not fire when only opponent units are destroyed', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { BROTHER_MILOR: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, FIGHTER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // Defender receives 1 hit — fighter destroyed, but it's opponent's unit
    t.advanceRound({ defender: 1 })

    expect(t.abilityLog('BROTHER_MILOR')).toHaveLength(0)
  })

  it('declares its replacements for the hit order', () => {
    const setup = new CombatSetup()
    setup.setUnitCount('attacker', 'CRUISER', 1)
    const fighters = makeUnitLocator('FIGHTER', SPACE_SURFACE_ID)
    expect(hitOrderUnits(setup, 'SPACE')).not.toContain(fighters)

    setAbility(setup, 'attacker', 'BROTHER_MILOR', { isEnabled: true })
    expect(hitOrderUnits(setup, 'SPACE')).toContain(fighters)

    setup.setCombatMode('GROUND')
    setup.setUnitCount('attacker', 'MECH', 1)
    expect(hitOrderUnits(setup, 'GROUND')).toContain(
      makeUnitLocator('INFANTRY', DEFAULT_PLANET_ID),
    )
  })
})
