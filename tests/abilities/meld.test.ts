import { describe, expect, it } from 'vitest'

import { all, pendingHits } from '../utils/branches'
import { combatTest } from '../utils/combat-test'

describe('TF_MELD', () => {
  it('melds a single own die, leaving the opponent untouched', () => {
    // Attacker cruiser combat 7, melded die = 2d10 summed, capped at 10:
    // P(hit) = 1 - (6·5)/200 = 0.85. Defender cruiser rolls naturally (0.4).
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 1 },
        abilities: { TF_MELD: true },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    const branches = t.advance()

    // [hits attacker receives, hits defender receives]
    expect(branches).toHaveBranches(
      all(pendingHits('attacker'), pendingHits('defender')),
      [
        { value: [1, 1], probability: 0.34 },
        { value: [1, 0], probability: 0.06 },
        { value: [0, 1], probability: 0.51 },
        { value: [0, 0], probability: 0.09 },
      ],
    )
  })

  it('picks the hardest-to-hit own die (highest hit value)', () => {
    // Cruiser 7 and dreadnought 5: the cruiser die gains more from melding
    // (0.4 → 0.85), so it is chosen; the dreadnought stays natural (0.6).
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 1, DREADNOUGHT: 1 },
        abilities: { TF_MELD: true },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    const branches = t.advance()

    expect(branches).toHaveBranches(pendingHits('defender'), [
      { value: 2, probability: 0.51 }, // 0.85 · 0.6
      { value: 1, probability: 0.43 }, // 0.85·0.4 + 0.15·0.6
      { value: 0, probability: 0.06 }, // 0.15 · 0.4
    ])
  })

  it('bills one use per melded roll and stops when spent', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 1 },
        abilities: { TF_MELD: true },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    // Round 1 melds the cruiser die and consumes the card.
    t.advanceRound()
    expect(t.state.attacker.abilities.TF_MELD.uses).toBe(0)

    // Round 2 rolls naturally: 0.4 each side.
    const branches = t.advance()
    expect(branches).toHaveBranches(
      all(pendingHits('attacker'), pendingHits('defender')),
      [
        { value: [1, 1], probability: 0.16 },
        { value: [1, 0], probability: 0.24 },
        { value: [0, 1], probability: 0.24 },
        { value: [0, 0], probability: 0.36 },
      ],
    )
  })

  it('scope selects which rolls meld — unit-ability dice qualify only when chosen', () => {
    // Defender PDS space cannon 6: natural 0.5; melded 1 - (5·4)/200 = 0.9.
    const scoped = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
      defender: {
        faction: 'AVARICE_REX',
        units: { PDS: 1, CRUISER: 1 },
        abilities: { TF_MELD: { isEnabled: true, scope: 'UNIT_ABILITY' } },
      },
    })

    // First branching point is the Space Cannon Offense roll.
    expect(scoped.advance()).toHaveBranches(pendingHits('attacker'), [
      { value: 1, probability: 0.9 },
      { value: 0, probability: 0.1 },
    ])

    // Default scope (COMBAT) leaves the Space Cannon roll natural.
    const combatOnly = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
      defender: {
        faction: 'AVARICE_REX',
        units: { PDS: 1, CRUISER: 1 },
        abilities: { TF_MELD: true },
      },
    })

    expect(combatOnly.advance()).toHaveBranches(pendingHits('attacker'), [
      { value: 1, probability: 0.5 },
      { value: 0, probability: 0.5 },
    ])
  })
})
