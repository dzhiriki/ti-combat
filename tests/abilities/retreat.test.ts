import { describe, expect, it } from 'vitest'

import type { SavedRetreatData } from '@/data/main'

import { combatTest } from '../utils/combat-test'

function getRetreatSaved(
  t: ReturnType<typeof combatTest>,
  side: 'attacker' | 'defender',
) {
  return (t.state[side].abilities.RETREAT as Record<string, unknown>)
    ?._saved as SavedRetreatData | undefined
}

describe.forEachSide('RETREAT', () => {
  it('ends combat after 1 round with surviving units', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
        abilities: { RETREAT: { isEnabled: true, rounds: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    expect(t.isFinished()).toBe(true)
    // Retreated units stored in RETREAT config
    expect(getRetreatSaved(t, 'attacker')?.savedUnits.CRUISER).toHaveLength(3)
    expect(t.defender.units.CRUISER).toHaveLength(3)
  })

  it('ends combat after 2 rounds', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
        abilities: { RETREAT: { isEnabled: true, rounds: 2 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound() // round 1

    expect(t.isFinished()).toBe(false)

    t.advanceRound() // round 2

    expect(t.isFinished()).toBe(true)
    expect(getRetreatSaved(t, 'attacker')?.savedUnits.CRUISER).toHaveLength(3)
    expect(t.defender.units.CRUISER).toHaveLength(3)
  })

  it('earlier retreat triggers when both sides have different rounds', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
        abilities: { RETREAT: { isEnabled: true, rounds: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
        abilities: { RETREAT: { isEnabled: true, rounds: 3 } },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    expect(t.isFinished()).toBe(true)
    expect(getRetreatSaved(t, 'attacker')?.savedUnits.CRUISER).toHaveLength(3)
    expect(t.defender.units.CRUISER).toHaveLength(3)
  })
})
