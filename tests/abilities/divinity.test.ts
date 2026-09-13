import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('TF_DIVINITY', () => {
  it('saves a unit from destruction during space combat', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 1 },
        abilities: { TF_DIVINITY: true },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1 })

    // The 1 incoming hit is cancelled → the lone cruiser survives
    expect(t.abilityLog('TF_DIVINITY')).not.toHaveLength(0)
    expect(t.attacker.units.CRUISER).toHaveLength(1)
  })

  it('is not spent when the unit it would save is unchecked', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { FIGHTER: 1, CRUISER: 1 },
        abilities: {
          TF_DIVINITY: {
            isEnabled: true,
            spaceTargets: [
              ['FIGHTER', false],
              ['CRUISER', true],
            ],
          },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    // 1 hit lands on the fighter (front of the assign order) — a cancel
    // would only save the fighter, which is unchecked.
    t.advanceRound({ attacker: 1 })

    expect(t.abilityLog('TF_DIVINITY')).toHaveLength(0)
    expect(t.attacker.units.FIGHTER).toBeUndefined()
    expect(t.state.attacker.abilities.TF_DIVINITY.uses).toBe(1)
  })

  it('spends the save when the last-hit unit is a checked type', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { FIGHTER: 1, CRUISER: 1 },
        abilities: {
          TF_DIVINITY: {
            isEnabled: true,
            spaceTargets: [
              ['FIGHTER', false],
              ['CRUISER', true],
            ],
          },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    // 2 hits would kill fighter + cruiser; cancelling one saves the cruiser.
    t.advanceRound({ attacker: 2 })

    expect(t.abilityLog('TF_DIVINITY')).not.toHaveLength(0)
    expect(t.attacker.units.FIGHTER).toBeUndefined()
    expect(t.attacker.units.CRUISER).toHaveLength(1)
  })

  it('also saves a unit during ground combat', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'GROUND',
      attacker: {
        faction: 'AVARICE_REX',
        units: { INFANTRY: 1 },
        abilities: { TF_DIVINITY: true },
      },
      defender: { faction: 'AVARICE_REX', units: { INFANTRY: 2 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ attacker: 1 })

    expect(t.abilityLog('TF_DIVINITY')).not.toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(1)
  })
})
