import { describe, expect, it } from 'vitest'

import { all, pendingHits, unitCount } from '../utils/branches'
import { combatTest } from '../utils/combat-test'

describe('CROWN_OF_THALNOS', () => {
  it.fails('selected single die, miss is rerolled and may destroy unit', () => {
    // 1 attacker cruiser [7,1] with CROWN selecting CRUISER (safeReroll off).
    // Attacker cruiser dice: face 7-10 (0.4) → natural hit, NOT rerolled.
    //                       face 1-6 (0.6) → reroll with +1.
    //   Reroll resolves on shifted hit value 6: faces 6-10 hit (0.5),
    //   faces 1-5 miss (0.5).
    // P(hit, alive) = 0.4 (natural) + 0.6 * 0.5 = 0.7
    // P(miss, destroyed) = 0.6 * 0.5 = 0.3
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: {
          CROWN_OF_THALNOS: {
            isEnabled: true,
            safeReroll: false,
            selectedUnitTypes: [['CRUISER', true]],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CARRIER: 1 } },
    })

    const branches = t.advance()

    expect(branches).toHaveBranches(
      all(unitCount('attacker', 'CRUISER'), pendingHits('defender')),
      [
        {
          value: [1, 1],
          probability: 0.7,
        },
        {
          value: [0, 0],
          probability: 0.3,
        },
      ],
    )
  })

  it('safe-mode rerolls only when unit already hit; unit never destroyed', () => {
    // ARBOREC FLAGSHIP [7,2] (2 dice on one unit) rolls 2 dice at hit 7+.
    // Per die hit prob 0.4, miss 0.6.
    //   HH (0.16): no reroll
    //   HM/MH (0.48): one hit already, safe-mode rerolls the miss with +1
    //                 → unit alive whether or not the reroll succeeds
    //   MM (0.36): no hits — safe predicate (unitHitsBeforeReroll>0 ||
    //              hitValue<=2) is false → NO reroll, unit alive (no
    //              destruction risk because nothing was rerolled).
    //
    // Flagship is NEVER destroyed in safe mode.
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { FLAGSHIP: 1 },
        abilities: {
          CROWN_OF_THALNOS: {
            isEnabled: true,
            safeReroll: true,
            selectedUnitTypes: [],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CARRIER: 1 } },
    })

    const branches = t.advance()

    expect(branches).toHaveBranches(unitCount('attacker', 'FLAGSHIP'), [
      { value: 1, probability: 1 },
    ])

    expect(branches).toHaveBranches(pendingHits('defender'), [
      { value: 0, probability: 0.36 },
      { value: 1, probability: 0.24 },
      { value: 2, probability: 0.4 },
    ])
  })

  it('safe-mode single-die unit: no reroll, no destruction risk', () => {
    // Single cruiser, hitValue=7, dicePerUnit=1:
    //   hit (face 7-10, 0.4) → natural, NOT rerolled
    //   miss (face 1-6, 0.6) → safe predicate is false (hitValue>2 AND
    //     unitHitsBeforeReroll=0) → NO reroll
    // No reroll ever happens → unit stays alive.
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: {
          CROWN_OF_THALNOS: {
            isEnabled: true,
            safeReroll: true,
            selectedUnitTypes: [],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CARRIER: 1 } },
    })

    const branches = t.advance()

    expect(branches).toHaveBranches(pendingHits('defender'), [
      { value: 0, probability: 0.6 },
      { value: 1, probability: 0.4 },
    ])
  })

  it.fails('selected with multi-die unit (FLAGSHIP) — destruction only when ALL dice miss after reroll', () => {
    // ARBOREC FLAGSHIP [7,2] selected by Crown, safeReroll OFF. Note: Crown's
    // destroyUnits bypasses Sustain Damage (forced destroy).
    // shouldReroll: !isNaturalHit && selectedSet.has(unitId)
    // Per die: natural hit faces 7-10 (0.4), miss faces 1-6 (0.6).
    //
    // After rerolls (+1 modifier → reroll hits on face >=6 = prob 0.5):
    //   Per-die effective hit prob: 0.4 + 0.6 * 0.5 = 0.7
    //   Per-die effective miss prob: 0.6 * 0.5 = 0.3
    //
    // Unit destroyed iff final unit_hits == 0:
    //   P(both miss) = 0.3 * 0.3 = 0.09
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { FLAGSHIP: 1 },
        abilities: {
          CROWN_OF_THALNOS: {
            isEnabled: true,
            safeReroll: false,
            selectedUnitTypes: [['FLAGSHIP', true]],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CARRIER: 1 } },
    })

    const branches = t.advance()

    expect(branches).toHaveBranches(unitCount('attacker', 'FLAGSHIP'), [
      { value: 0, probability: 0.09 },
      { value: 1, probability: 0.91 },
    ])

    expect(branches).toHaveBranches(pendingHits('defender'), [
      { value: 0, probability: 0.09 },
      { value: 1, probability: 0.42 },
      { value: 2, probability: 0.49 },
    ])
  })

  it('safe-mode rerolls hitValue<=2 unit; reroll always converts and unit is never destroyed', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { DREADNOUGHT: 1 },
        abilities: {
          RICKAR_RICKANI: true,
          CROWN_OF_THALNOS: {
            isEnabled: true,
            safeReroll: true,
            selectedUnitTypes: [],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CARRIER: 1 } },
    })

    const branches = t.advance()

    expect(branches).toHaveBranches(pendingHits('defender'), [
      { value: 1, probability: 1 },
    ])
  })

  it.fails('rerolls with hitValue<=2 unit; reroll always converts and unit is never destroyed', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { DREADNOUGHT: 1 },
        abilities: {
          RICKAR_RICKANI: true,
          CROWN_OF_THALNOS: {
            isEnabled: true,
            safeReroll: false,
            selectedUnitTypes: [['DREADNOUGHT', true]],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CARRIER: 1 } },
    })

    const branches = t.advance()

    expect(branches).toHaveBranches(pendingHits('defender'), [
      { value: 1, probability: 1 },
    ])
  })

  it.fails('selected predicate matches first, safe-mode is fallback', () => {
    // CRUISER selected AND safeReroll on. The selected predicate is declared
    // FIRST, so its predicate wins for selected units' dice. Destruction is
    // identical to the safe-off case (P(destroyed)=0.3 for single cruiser).
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: {
          CROWN_OF_THALNOS: {
            isEnabled: true,
            safeReroll: true,
            selectedUnitTypes: [['CRUISER', true]],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CARRIER: 1 } },
    })

    const branches = t.advance()

    expect(branches).toHaveBranches(unitCount('attacker', 'CRUISER'), [
      { value: 0, probability: 0.3 },
    ])
  })
})
