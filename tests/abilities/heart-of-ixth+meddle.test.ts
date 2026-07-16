import { describe, expect, it } from 'vitest'

import { all, currentUses, pendingHits } from '../utils/branches'
import { combatTest } from '../utils/combat-test'

// Heart of Ixth (relic) and Meddle (TF action card) are the same ±1 die flip
// and can BOTH be held by a Twilight's Fall side. Two independent flips must
// stack like the one-sided conditional batch does: a die exactly 2 below its
// hit value spends both cards to become a hit.
describe('HEART_OF_IXTH + TF_MEDDLE', () => {
  // PDS space cannon 6 firing one die at an incoming infantry. Natural hit
  // 6-10 (0.5); face 5 flips with either card (0.1); face 4 flips with BOTH
  // (0.1) → 70% total. The old per-modifier pass could neither reach face 4
  // nor stop re-enumerating face 5, showing 68%.
  it('defaults (anyPreferOwn): PDS hits an incoming infantry 70% of the time', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: { faction: 'AVARICE_REX', units: { INFANTRY: 1 } },
      defender: {
        faction: 'AVARICE_REX',
        units: { PDS: 1 },
        abilities: {
          HEART_OF_IXTH: { isEnabled: true },
          TF_MEDDLE: { isEnabled: true },
        },
      },
    })

    const branches = t.advance()

    expect(branches).toHaveBranches(pendingHits('attacker'), [
      { value: 1, probability: 0.7 },
      { value: 0, probability: 0.3 },
    ])
  })

  it("target='own' on both: same 70% via the one-sided batch path", () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: { faction: 'AVARICE_REX', units: { INFANTRY: 1 } },
      defender: {
        faction: 'AVARICE_REX',
        units: { PDS: 1 },
        abilities: {
          HEART_OF_IXTH: { isEnabled: true, target: 'own' },
          TF_MEDDLE: { isEnabled: true, target: 'own' },
        },
      },
    })

    const branches = t.advance()

    expect(branches).toHaveBranches(pendingHits('attacker'), [
      { value: 1, probability: 0.7 },
      { value: 0, probability: 0.3 },
    ])
  })

  // Opposing owners: the infantry side holds Meddle, the PDS side holds Heart
  // of Ixth (both 'anyPreferOwn'). On the single PDS die the flips act on
  // disjoint natural faces — Meddle cancels a natural 6, Heart boosts a
  // natural 5 — so they net out to exactly 50%. The old sequential pass
  // re-sampled the boost face after the cancel, inflating the PDS to 52%.
  it('on opposing sides: PDS vs incoming infantry is exactly 50/50', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'AVARICE_REX',
        units: { INFANTRY: 1 },
        abilities: { TF_MEDDLE: { isEnabled: true } },
      },
      defender: {
        faction: 'AVARICE_REX',
        units: { PDS: 1 },
        abilities: { HEART_OF_IXTH: { isEnabled: true } },
      },
    })

    const branches = t.advance()

    // Tuples: [hits pending on attacker, Heart uses left (defender), Meddle
    // uses left (attacker)].
    expect(branches).toHaveBranches(
      all(
        pendingHits('attacker'),
        currentUses('defender', 'HEART_OF_IXTH'),
        currentUses('attacker', 'TF_MEDDLE'),
      ),
      [
        { value: [1, 1, 1], probability: 0.4 },
        { value: [0, 1, 0], probability: 0.1 },
        { value: [1, 0, 1], probability: 0.1 },
        { value: [0, 1, 1], probability: 0.4 },
      ],
    )
  })

  // Mixed targets on opposing sides: the PDS side's Heart is one-sided
  // ("Only own"), the infantry side's Meddle stays two-sided 'anyPreferOwn'.
  // One-sided and two-sided flips must resolve in the SAME pass — resolving
  // Heart first and re-enumerating for Meddle counted the boosted natural 5
  // as a cancellable natural 6, tilting the PDS to 48%.
  it("PDS with target='own' vs infantry holding Meddle: still 50/50", () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'AVARICE_REX',
        units: { INFANTRY: 1 },
        abilities: { TF_MEDDLE: { isEnabled: true } },
      },
      defender: {
        faction: 'AVARICE_REX',
        units: { PDS: 1 },
        abilities: { HEART_OF_IXTH: { isEnabled: true, target: 'own' } },
      },
    })

    const branches = t.advance()

    expect(branches).toHaveBranches(
      all(
        pendingHits('attacker'),
        currentUses('defender', 'HEART_OF_IXTH'),
        currentUses('attacker', 'TF_MEDDLE'),
      ),
      [
        { value: [1, 1, 1], probability: 0.4 },
        { value: [0, 1, 0], probability: 0.1 },
        { value: [1, 0, 1], probability: 0.1 },
        { value: [0, 1, 1], probability: 0.4 },
      ],
    )
  })

  // The mirror mix: Heart stays 'anyPreferOwn' on the PDS side while the
  // infantry side's Meddle is one-sided ("Only opponent", -1 on PDS dice).
  it("PDS 'any' vs infantry Meddle target='opponent': still 50/50", () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'AVARICE_REX',
        units: { INFANTRY: 1 },
        abilities: { TF_MEDDLE: { isEnabled: true, target: 'opponent' } },
      },
      defender: {
        faction: 'AVARICE_REX',
        units: { PDS: 1 },
        abilities: { HEART_OF_IXTH: { isEnabled: true } },
      },
    })

    const branches = t.advance()

    expect(branches).toHaveBranches(
      all(
        pendingHits('attacker'),
        currentUses('defender', 'HEART_OF_IXTH'),
        currentUses('attacker', 'TF_MEDDLE'),
      ),
      [
        { value: [1, 1, 1], probability: 0.4 },
        { value: [0, 1, 0], probability: 0.1 },
        { value: [1, 0, 1], probability: 0.1 },
        { value: [0, 1, 1], probability: 0.4 },
      ],
    )
  })

  // Opposing owners in a 1v1 infantry ground roll (both hit on 8), both cards
  // 'anyPreferOwn'. Each card prefers boosting its owner's face-7 miss and
  // otherwise cancels the opponent's natural face-8 hit; a die one owner
  // flipped is never re-targeted by the other (disjoint natural-face pools).
  it('on opposing sides: both-roll flips stay in disjoint natural-face pools', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'AVARICE_REX',
        units: { INFANTRY: 1 },
        abilities: { HEART_OF_IXTH: { isEnabled: true } },
      },
      defender: {
        faction: 'AVARICE_REX',
        units: { INFANTRY: 1 },
        abilities: { TF_MEDDLE: { isEnabled: true } },
      },
    })

    const branches = t.advance()

    // Tuples: [hits pending on defender (attacker's roll), hits pending on
    // attacker (defender's roll), Heart uses left (attacker), Meddle uses
    // left (defender)].
    expect(branches).toHaveBranches(
      all(
        pendingHits('defender'),
        pendingHits('attacker'),
        currentUses('attacker', 'HEART_OF_IXTH'),
        currentUses('defender', 'TF_MEDDLE'),
      ),
      [
        { value: [1, 1, 1, 1], probability: 0.04 },
        { value: [1, 0, 0, 1], probability: 0.08 },
        { value: [1, 1, 1, 0], probability: 0.03 },
        { value: [1, 0, 1, 1], probability: 0.12 },
        { value: [0, 1, 1, 0], probability: 0.08 },
        { value: [0, 0, 0, 0], probability: 0.01 },
        { value: [1, 1, 0, 1], probability: 0.03 },
        { value: [0, 0, 1, 0], probability: 0.06 },
        { value: [1, 1, 0, 0], probability: 0.01 },
        { value: [0, 1, 1, 1], probability: 0.12 },
        { value: [0, 0, 0, 1], probability: 0.06 },
        { value: [0, 0, 1, 1], probability: 0.36 },
      ],
    )
  })

  // Both cards 'anyPreferOwn' on the defender in a 1v1 infantry ground roll
  // (both hit on 8). Per die: own +1 reaches faces 7 (tier 1, one card) and 6
  // (tier 2, both cards); opponent -1 cancels faces 8 (tier 1) and 9 (tier 2),
  // never a natural 10. The shared budget allocates own flips first, cheapest
  // tier first; uses bill to Heart before Meddle (sorted by ability key).
  it("target='anyPreferOwn' on both: joint budget stacks across both sides", () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: { faction: 'AVARICE_REX', units: { INFANTRY: 1 } },
      defender: {
        faction: 'AVARICE_REX',
        units: { INFANTRY: 1 },
        abilities: {
          HEART_OF_IXTH: { isEnabled: true },
          TF_MEDDLE: { isEnabled: true },
        },
      },
    })

    const branches = t.advance()

    // Tuples: [hits pending on defender (attacker's roll), hits pending on
    // attacker (defender's roll), Heart uses left, Meddle uses left].
    expect(branches).toHaveBranches(
      all(
        pendingHits('defender'),
        pendingHits('attacker'),
        currentUses('defender', 'HEART_OF_IXTH'),
        currentUses('defender', 'TF_MEDDLE'),
      ),
      [
        { value: [0, 1, 1, 1], probability: 0.21 },
        { value: [0, 1, 0, 1], probability: 0.1 },
        { value: [0, 1, 0, 0], probability: 0.11 },
        { value: [1, 1, 1, 1], probability: 0.03 },
        { value: [1, 1, 0, 1], probability: 0.02 },
        { value: [1, 1, 0, 0], probability: 0.03 },
        { value: [0, 0, 1, 1], probability: 0.35 },
        { value: [0, 0, 0, 1], probability: 0.05 },
        { value: [0, 0, 0, 0], probability: 0.05 },
        { value: [1, 0, 1, 1], probability: 0.05 },
      ],
    )
  })
})
