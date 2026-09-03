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

function dicePoolEntries(t: ReturnType<typeof combatTest>): number {
  return t.log.filter(e => e.path[e.path.length - 1] === 'DICE_POOL').length
}

describe.forEachSide('TF_FEINT', () => {
  it('retreats at the announcement — the combat round is never fought', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 3 },
        abilities: {
          RETREAT: { isEnabled: true, rounds: 1 },
          TF_FEINT: true,
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    expect(t.isFinished()).toBe(true)
    // All three cruisers left before any dice were rolled.
    expect(getRetreatSaved(t, 'attacker')?.savedUnits.CRUISER).toHaveLength(3)
    expect(dicePoolEntries(t)).toBe(0)
    expect(t.defender.units.CRUISER).toHaveLength(3)
  })

  it('waits for the announced round — earlier rounds are fought normally', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 3 },
        abilities: {
          RETREAT: { isEnabled: true, rounds: 2 },
          TF_FEINT: true,
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT')
    // Round 1: no retreat announced yet — dice are rolled, a cruiser dies.
    t.advanceRound({ attacker: 1 })
    expect(t.isFinished()).toBe(false)
    expect(dicePoolEntries(t)).toBe(1)

    // Round 2: the retreat is announced and Feint pulls it forward.
    t.advanceRound()
    expect(t.isFinished()).toBe(true)
    expect(getRetreatSaved(t, 'attacker')?.savedUnits.CRUISER).toHaveLength(2)
    expect(dicePoolEntries(t)).toBe(1)
  })

  it('without a retreat announced it does nothing', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 3 },
        abilities: { TF_FEINT: true },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    expect(t.isFinished()).toBe(false)
    expect(dicePoolEntries(t)).toBe(1)
    expect(t.state.attacker.abilities.TF_FEINT.uses).toBe(1)
  })
})
