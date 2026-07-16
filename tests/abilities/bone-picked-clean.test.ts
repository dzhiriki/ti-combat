import { describe, expect, it } from 'vitest'

import { all, currentUses, pendingHits } from '../utils/branches'
import { combatTest } from '../utils/combat-test'

// A Sickening Lurch mech: spend 1 captured infantry after rolling to reroll
// THAT mech's dice. Uses counter = infantry available (1 per mech rerolled);
// the spend threshold picks how many misses a mech needs before an infantry
// is spent on it.
describe('TF_BONE_PICKED_CLEAN', () => {
  it("rerolls a single mech's missed dice, spending a use only when it fires", () => {
    // Mech [5,2]: p(hit) = 0.6 per die. With one reroll of misses:
    //   natural 2 hits (0.36): nothing to reroll → use kept
    //   natural 1 hit (0.48): 1 die rerolled → 2 hits 0.288 / 1 hit 0.192
    //   natural 0 hits (0.16): 2 rerolled → 2: 0.0576 / 1: 0.0768 / 0: 0.0256
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'SICKENING_LURCH',
        units: { MECH: 1 },
        abilities: { TF_BONE_PICKED_CLEAN: { isEnabled: true, uses: 1 } },
      },
      defender: { faction: 'AVARICE_REX', units: { INFANTRY: 5 } },
    })

    const branches = t.advance()

    expect(branches).toHaveBranches(
      all(
        pendingHits('defender'),
        currentUses('attacker', 'TF_BONE_PICKED_CLEAN'),
      ),
      [
        { value: [2, 1], probability: 0.36 },
        { value: [2, 0], probability: 0.3456 },
        { value: [1, 0], probability: 0.2688 },
        { value: [0, 0], probability: 0.0256 },
      ],
    )
  })

  it('two mechs need one infantry EACH — one use covers only one of them', () => {
    // 2 mechs [5,2], uses 1, threshold 1. Per mech natural hits
    // h ∈ {2: .36, 1: .48, 0: .16}. Only ONE qualifying mech (the one with
    // more misses) rerolls; the budget can't cover both.
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'SICKENING_LURCH',
        units: { MECH: 2 },
        abilities: { TF_BONE_PICKED_CLEAN: { isEnabled: true, uses: 1 } },
      },
      defender: { faction: 'AVARICE_REX', units: { INFANTRY: 8 } },
    })

    const branches = t.advance()

    expect(branches).toHaveBranches(
      all(
        pendingHits('defender'),
        currentUses('attacker', 'TF_BONE_PICKED_CLEAN'),
      ),
      [
        { value: [4, 1], probability: 0.1296 },
        { value: [4, 0], probability: 0.248832 },
        { value: [3, 0], probability: 0.387072 },
        { value: [2, 0], probability: 0.193536 },
        { value: [1, 0], probability: 0.036864 },
        { value: [0, 0], probability: 0.004096 },
      ],
    )
  })

  it('two uses cover both missing mechs', () => {
    // Same setup with uses 2 — every qualifying mech rerolls, so each die is
    // an independent reroll-once trial: per die 0.6 + 0.4·0.6 = 0.84,
    // binomial(4, 0.84) over total hits. Uses spent = mechs that missed.
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'SICKENING_LURCH',
        units: { MECH: 2 },
        abilities: { TF_BONE_PICKED_CLEAN: { isEnabled: true, uses: 2 } },
      },
      defender: { faction: 'AVARICE_REX', units: { INFANTRY: 8 } },
    })

    const branches = t.advance()

    expect(branches).toHaveBranches(pendingHits('defender'), [
      { value: 4, probability: 0.49787136 },
      { value: 3, probability: 0.37933056 },
      { value: 2, probability: 0.10838016 },
      { value: 1, probability: 0.01376256 },
      { value: 0, probability: 0.00065536 },
    ])
  })

  it('a mech rerolls once per round — new misses are not rerolled again', () => {
    // 1 mech [5,2] with uses 2: only ONE infantry can be spent on it per
    // round, and the rerolled dice are final. If the fresh misses rerolled
    // again, the miss branches ([1,·]/[0,·]) would shrink below these values.
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'SICKENING_LURCH',
        units: { MECH: 1 },
        abilities: { TF_BONE_PICKED_CLEAN: { isEnabled: true, uses: 2 } },
      },
      defender: { faction: 'AVARICE_REX', units: { INFANTRY: 5 } },
    })

    const branches = t.advance()

    expect(branches).toHaveBranches(
      all(
        pendingHits('defender'),
        currentUses('attacker', 'TF_BONE_PICKED_CLEAN'),
      ),
      [
        { value: [2, 2], probability: 0.36 },
        { value: [2, 1], probability: 0.3456 },
        { value: [1, 1], probability: 0.2688 },
        { value: [0, 1], probability: 0.0256 },
      ],
    )
  })

  it('spend threshold 2: a mech with a single miss keeps the infantry', () => {
    // 1 mech [5,2], uses 1, threshold '2' — only a double miss (0.16)
    // triggers the reroll.
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'SICKENING_LURCH',
        units: { MECH: 1 },
        abilities: {
          TF_BONE_PICKED_CLEAN: {
            isEnabled: true,
            uses: 1,
            spendThreshold: '2',
          },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { INFANTRY: 5 } },
    })

    const branches = t.advance()

    expect(branches).toHaveBranches(
      all(
        pendingHits('defender'),
        currentUses('attacker', 'TF_BONE_PICKED_CLEAN'),
      ),
      [
        { value: [2, 1], probability: 0.36 },
        { value: [1, 1], probability: 0.48 },
        { value: [2, 0], probability: 0.0576 },
        { value: [1, 0], probability: 0.0768 },
        { value: [0, 0], probability: 0.0256 },
      ],
    )
  })

  it("rerolls only the mech's dice — accompanying infantry misses stay", () => {
    // Mech [5,2] with reroll → per-die 0.84 → hits m: 2 0.7056 / 1 0.2688 /
    // 0 0.0256. Infantry [8,1] NOT rerolled → 1 hit 0.3 / 0 hits 0.7.
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'SICKENING_LURCH',
        units: { MECH: 1, INFANTRY: 1 },
        abilities: { TF_BONE_PICKED_CLEAN: { isEnabled: true, uses: 1 } },
      },
      defender: { faction: 'AVARICE_REX', units: { INFANTRY: 5 } },
    })

    const branches = t.advance()

    expect(branches).toHaveBranches(pendingHits('defender'), [
      { value: 3, probability: 0.21168 },
      { value: 2, probability: 0.57456 },
      { value: 1, probability: 0.19584 },
      { value: 0, probability: 0.01792 },
    ])
  })

  it('does not reroll with zero uses', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'SICKENING_LURCH',
        units: { MECH: 1 },
        abilities: { TF_BONE_PICKED_CLEAN: { isEnabled: true, uses: 0 } },
      },
      defender: { faction: 'AVARICE_REX', units: { INFANTRY: 5 } },
    })

    const branches = t.advance()

    // Natural binomial(2, 0.6) — no reroll.
    expect(branches).toHaveBranches(pendingHits('defender'), [
      { value: 2, probability: 0.36 },
      { value: 1, probability: 0.48 },
      { value: 0, probability: 0.16 },
    ])
  })
})
