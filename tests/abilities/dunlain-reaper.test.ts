import { describe, expect, it } from 'vitest'

import { makeUnitLocator } from '@/combat'
import { CombatSetup } from '@/hooks/combat-setup'
import { DEFAULT_PLANET_ID } from '@/types'

import { combatTest } from '../utils/combat-test'
import { hitOrderUnits, setAbility } from '../utils/setup-options'

describe.forEachSide('DUNLAIN_REAPER', () => {
  it('replaces infantry with mech at start of combat round', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { INFANTRY: 3 },
        abilities: { DUNLAIN_REAPER: { uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    expect(t.attacker.units.INFANTRY).toHaveLength(2)
    expect(t.attacker.units.MECH).toHaveLength(1)
    expect(t.abilityLog('DUNLAIN_REAPER')).not.toHaveLength(0)
  })

  it('fires each round while uses remain', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { INFANTRY: 3 },
        abilities: { DUNLAIN_REAPER: { uses: 2 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()
    t.advanceRound()

    expect(t.attacker.units.INFANTRY).toHaveLength(1)
    expect(t.attacker.units.MECH).toHaveLength(2)
    expect(t.abilityLog('DUNLAIN_REAPER')).not.toHaveLength(0)
  })

  it('does not fire when no infantry present', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { MECH: 1 },
        abilities: { DUNLAIN_REAPER: { uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    expect(t.attacker.units.MECH).toHaveLength(1)
    expect(t.abilityLog('DUNLAIN_REAPER')).toHaveLength(0)
  })

  it('does not fire when no mechs are available in reinforcements', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { MECH: 4, INFANTRY: 2 },
        abilities: { DUNLAIN_REAPER: { uses: 1, availableMechs: 0 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    expect(t.attacker.units.MECH).toHaveLength(4)
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
    expect(t.abilityLog('DUNLAIN_REAPER')).toHaveLength(0)
  })

  it('decrements availableMechs after each deploy', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { INFANTRY: 3 },
        abilities: { DUNLAIN_REAPER: { uses: 3, availableMechs: 2 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()
    t.advanceRound()
    t.advanceRound()

    expect(t.attacker.units.MECH).toHaveLength(2)
    expect(t.attacker.units.INFANTRY).toHaveLength(1)
    expect(t.abilityLog('DUNLAIN_REAPER')).toHaveLength(2)
  })

  it('refunds availableMechs when own mechs are destroyed', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { MECH: 1, INFANTRY: 1 },
        abilities: { DUNLAIN_REAPER: { uses: 1, availableMechs: 0 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 4 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ attacker: 3 })

    expect(t.attacker.units.MECH).toBeUndefined()
    expect(t.state.attacker.abilities.DUNLAIN_REAPER?.availableMechs).toBe(1)
  })

  it('declares its mech for the hit order while mechs remain', () => {
    const setup = new CombatSetup()
    setup.setFaction('attacker', 'BARONY_OF_LETNEV')
    setup.setCombatMode('GROUND')
    setup.setUnitCount('attacker', 'INFANTRY', 2)
    const mech = makeUnitLocator('MECH', DEFAULT_PLANET_ID)
    expect(hitOrderUnits(setup, 'GROUND')).not.toContain(mech)

    setAbility(setup, 'attacker', 'DUNLAIN_REAPER', { uses: 1 })
    expect(hitOrderUnits(setup, 'GROUND')).toContain(mech)

    setAbility(setup, 'attacker', 'DUNLAIN_REAPER', { availableMechs: 0 })
    expect(hitOrderUnits(setup, 'GROUND')).not.toContain(mech)
  })
})
