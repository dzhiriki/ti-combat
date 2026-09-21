import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('ANTI_FIGHTER_BARRAGE', () => {
  it('both sides barrage simultaneously in a single roll', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { DESTROYER: 1, FIGHTER: 1 } },
      defender: { faction: 'ARBOREC', units: { DESTROYER: 1, FIGHTER: 1 } },
    })

    t.advanceToTiming('BEFORE_ASSIGN_HITS', 0, 'AFB')
    const pool = t.dicePool()

    // One combined AFB pool: both destroyers roll [9, 2] together.
    expect(pool.hitSource).toBe('AFB')
    expect(pool.attacker).toContainDice('DESTROYER', [9, 2])
    expect(pool.defender).toContainDice('DESTROYER', [9, 2])
  })

  it('the defender can opt out without disabling the attacker barrage', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { DESTROYER: 1, FIGHTER: 1 } },
      defender: {
        faction: 'ARBOREC',
        units: { DESTROYER: 1, FIGHTER: 1 },
        abilities: { ANTI_FIGHTER_BARRAGE: false },
      },
    })

    t.advanceToTiming('BEFORE_ASSIGN_HITS', 0, 'AFB')
    const pool = t.dicePool()

    // Attacker still barrages; defender's AFB units contribute no dice.
    expect(pool.attacker).toContainDice('DESTROYER', [9, 2])
    expect(pool.defender?.DESTROYER).toBeUndefined()
  })

  it('the attacker can opt out without disabling the defender barrage', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DESTROYER: 1, FIGHTER: 1 },
        abilities: { ANTI_FIGHTER_BARRAGE: false },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DESTROYER: 1, FIGHTER: 1 },
      },
    })

    t.advanceToTiming('BEFORE_ASSIGN_HITS', 0, 'AFB')
    const pool = t.dicePool()

    // Defender still barrages; attacker's AFB units contribute no dice.
    expect(pool.attacker?.DESTROYER).toBeUndefined()
    expect(pool.defender).toContainDice('DESTROYER', [9, 2])
  })

  it('uses fighter-only priority as both eligibility and order by default', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { DESTROYER: 1, CRUISER: 1 } },
      defender: {
        faction: 'ARBOREC',
        units: { FIGHTER: 1, CRUISER: 1 },
      },
    })

    t.advanceToTiming('ANNOUNCE_RETREAT_STEP', { defender: 1 })

    expect(t.defender.units.FIGHTER).toBeUndefined()
    expect(t.defender.units.CRUISER).toHaveLength(1)
  })

  it('keeps simultaneous firing-side priorities independent', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DESTROYER: 1, FIGHTER: 1, CRUISER: 1 },
        abilities: { WAYLAY: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DESTROYER: 1, CRUISER: 1 },
      },
    })

    t.advanceToTiming('ANNOUNCE_RETREAT_STEP', {
      attacker: 1,
      defender: 1,
    })

    expect(t.attacker.units.FIGHTER).toBeUndefined()
    expect(t.attacker.units.CRUISER).toHaveLength(1)
    expect(t.defender.units.DESTROYER).toBeUndefined()
    expect(t.defender.units.CRUISER).toHaveLength(1)
  })
})
