import { describe, expect, it } from 'vitest'

import type { DiceMathBranch } from '@/combat/dice-math/branch-accumulator'
import { marginalizeBaseHits } from '@/combat/dice-math/utils/marginalize-base-hits'

function branch(
  attackerBase: number,
  defenderBase: number,
  probability: number,
): DiceMathBranch {
  return {
    probability,
    pendingHitPool: {
      attacker: { base: attackerBase, custom: [] },
      defender: { base: defenderBase, custom: [] },
    },
    usesDelta: new Map(),
    pendingEffects: [],
  }
}

describe('marginalizeBaseHits', () => {
  it('sums probability by base-hit total for the landing side', () => {
    const branches = [
      branch(0, 0, 0.36),
      branch(0, 1, 0.48),
      branch(0, 2, 0.16),
    ]
    expect(marginalizeBaseHits(branches, 'defender')).toEqual([
      { hits: 0, probability: 0.36 },
      { hits: 1, probability: 0.48 },
      { hits: 2, probability: 0.16 },
    ])
  })

  it('merges branches with equal landing hits and sorts ascending', () => {
    const branches = [branch(2, 0, 0.1), branch(0, 0, 0.2), branch(1, 0, 0.7)]
    expect(marginalizeBaseHits(branches, 'attacker')).toEqual([
      { hits: 0, probability: 0.2 },
      { hits: 1, probability: 0.7 },
      { hits: 2, probability: 0.1 },
    ])
  })

  it('excludes custom sub-pool bases and skips zero-probability branches', () => {
    const withCustom: DiceMathBranch = {
      probability: 0.5,
      pendingHitPool: {
        attacker: {
          base: 1,
          custom: [{ key: 'X', base: 3, unitPriority: [] }],
        },
        defender: { base: 0, custom: [] },
      },
      usesDelta: new Map(),
      pendingEffects: [],
    }
    const zero = branch(5, 0, 0)
    expect(marginalizeBaseHits([withCustom, zero], 'attacker')).toEqual([
      { hits: 1, probability: 0.5 },
    ])
  })
})
