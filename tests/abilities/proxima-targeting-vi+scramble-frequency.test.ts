import { describe, expect, it } from 'vitest'

import type { CombatStateConfig } from '@/hooks/combat-setup/build-combat-state'

import { all, currentUses, pendingHits } from '../utils/branches'
import { combatTest } from '../utils/combat-test'

// Bomb dice: 3 INF at hit value 8 → per-die p = 0.3. Natural Binomial(3, 0.3)
// has hit distribution 0.343 / 0.441 / 0.189 / 0.027. Defender's Scramble has
// uses=1 and the default strategy `IF_HITS_PERCENT_GE 50` — "reroll when the
// roll is in the better-than-median half of its own marginal." The percentile
// uses the mean (midpoint) rank, which splits the probability mass tied at the
// rolled value. Against Binomial(3, 0.3) (mean 0.9) that means: fires on
// natural 1, 2 or 3 hits (all at or above the mean), skips only on 0.
//
// On the OPP-bomb (Bastion → ARB) the predicate runs as authored: 1-3 hits
// are bad for ARB → reroll. After the reroll, those branches sit at
// Binomial(3, 0.3) again — the high tail flattens out.
//
// On the SELF-bomb (Bastion → Bastion) the engine flips MISSES↔HITS and
// negates `rerollIf` so ARB's intent is preserved against self-routed dice
// (high hits-on-Bastion are good for ARB, not bad). The negated predicate
// fires on natural 0 hits, skipping 1, 2 or 3 (keeping any at-or-above-mean
// roll, since rerolling those would lower expected hits-on-Bastion).

const baseConfig: CombatStateConfig = {
  system: 'TI4',
  mode: 'GROUND',
  attacker: {
    faction: 'LAST_BASTION',
    units: { INFANTRY: 3 },
    abilities: {
      PROXIMA_TARGETING_VI: { isEnabled: true, resolveBombardment: true },
    },
  },
  defender: {
    faction: 'ARBOREC',
    units: { INFANTRY: 3 },
    abilities: { SCRAMBLE_FREQUENCY: { isEnabled: true } },
  },
}

describe('PROXIMA_TARGETING_VI + SCRAMBLE_FREQUENCY', () => {
  it('Scramble reduces opp-bomb hits; self-bomb is unaffected (use depleted)', () => {
    // Opp-bomb fires first (LIFO). Branches collapse to a grid keyed by
    // (defender hits, defender's remaining Scramble uses). `uses=1` is the
    // materialized default — Scramble didn't fire on that branch. `uses=0`
    // means the use was consumed.
    //
    //   nat=0 (0.343): predicate skips → uses=1.
    //   nat=1 (0.441), nat=2 (0.189), nat=3 (0.027): predicate fires → reroll
    //     all 3 dice at p=0.3 → Binomial(3, 0.3) again, with uses billed once.
    //     Fired mass 0.441+0.189+0.027=0.657 is redistributed across
    //     (defH ∈ 0..3, uses=0): 0.657 * {0.343, 0.441, 0.189, 0.027}.
    const t = combatTest(baseConfig)
    const oppBranches = t.advance()
    expect(oppBranches).toHaveBranches(
      all(
        pendingHits('defender'),
        currentUses('defender', 'SCRAMBLE_FREQUENCY'),
      ),
      [
        { value: [0, 1], probability: 0.343 },
        { value: [0, 0], probability: 0.225351 },
        { value: [1, 0], probability: 0.289737 },
        { value: [2, 0], probability: 0.124173 },
        { value: [3, 0], probability: 0.017739 },
      ],
    )

    // Pick a branch where Scramble fired on opp-bomb (use depleted). The
    // self-bomb's `isCallable` skips Scramble because uses=0, so the dice
    // resolve naturally: Binomial(3, 0.3). Hits are produced on the natural
    // opponent (defender's pool) and swapped to the attacker only after the
    // roll, so the branch distribution is keyed by defender here.
    const oppFired = oppBranches.find(
      b =>
        pendingHits('defender')(b) === 0 &&
        currentUses('defender', 'SCRAMBLE_FREQUENCY')(b) === 0,
    )!
    const selfAfterFired = oppFired.state.advance()
    expect(selfAfterFired).toHaveBranches(pendingHits('defender'), [
      { value: 0, probability: 0.343 },
      { value: 1, probability: 0.441 },
      { value: 2, probability: 0.189 },
      { value: 3, probability: 0.027 },
    ])
  })

  it("Scramble doesn't fire on a bad opp-bomb; engine-flip boosts the self-bomb", () => {
    // Pick a branch where Scramble did NOT fire on opp-bomb (natural 0 hits,
    // use still available). Self-bomb runs with the engine-flipped predicate
    // negated: fires on natural 0 hits, skips on 1, 2 or 3.
    //
    //   nat=0 (0.343): negated predicate fires → reroll all → Binomial(3,0.3)
    //                  branches at uses=0 with mass 0.343*{0.343,0.441,0.189,0.027}
    //                  = 0.117649, 0.151263, 0.064827, 0.009261.
    //   nat=1 (0.441), nat=2 (0.189), nat=3 (0.027): negated predicate skips →
    //                  uses untouched (uses=1) at defH = 1, 2, 3 respectively.
    //
    // The high tail (defH=1,2,3 at uses=1) is preserved rather than rerolled,
    // so more hits land on Bastion (good for ARB) than natural Binomial(3,0.3).
    // Hits are produced on the natural opponent (defender's pool) and swapped
    // to the attacker only after the roll, so the branch distribution is keyed
    // by defender here.
    const t = combatTest(baseConfig)
    const oppBranches = t.advance()
    const oppNotFired = oppBranches.find(
      b =>
        pendingHits('defender')(b) === 0 &&
        currentUses('defender', 'SCRAMBLE_FREQUENCY')(b) === 1,
    )!

    const selfAfterNotFired = oppNotFired.state.advance()
    expect(selfAfterNotFired).toHaveBranches(
      all(
        pendingHits('defender'),
        currentUses('defender', 'SCRAMBLE_FREQUENCY'),
      ),
      [
        { value: [0, 0], probability: 0.117649 },
        { value: [1, 0], probability: 0.151263 },
        { value: [2, 0], probability: 0.064827 },
        { value: [3, 0], probability: 0.009261 },
        { value: [1, 1], probability: 0.441 },
        { value: [2, 1], probability: 0.189 },
        { value: [3, 1], probability: 0.027 },
      ],
    )
  })
})
