import type { Ability, AbilityCallContext } from '@/combat'

/** P(one melded die hits at `hitValue`). A melded die is the sum of two d10s
 *  capped at 10, so every face pair (a, b) with a + b ≥ hitValue is a hit:
 *  P(sum < h) = Σ_{s=2..h-1} (s − 1)/100 = (h−1)(h−2)/200 for h in [3..10].
 *  h ≤ 2 always hits (the sum is at least 2); the cap makes h > 10
 *  unreachable even though two dice could sum past it. */
function meldHitProb(hitValue: number): number {
  if (hitValue <= 2) return 1
  if (hitValue > 10) return 0
  return 1 - ((hitValue - 1) * (hitValue - 2)) / 200
}

/** Per-unit PMF for a melded entry: `dpu` independent melded dice, each
 *  hitting with `meldHitProb` — Binomial(dpu, p). */
function meldPerUnitPmf(hitValue: number, dpu: number): number[] {
  const p = meldHitProb(hitValue)
  const out = new Array<number>(dpu + 1).fill(0)
  for (let k = 0; k <= dpu; k++) {
    out[k] = binomCoeff(dpu, k) * Math.pow(p, k) * Math.pow(1 - p, dpu - k)
  }
  return out
}

function binomCoeff(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
  return r
}

function declareMeld(ctx: AbilityCallContext): void {
  for (const side of [ctx.api.own, ctx.api.opponent]) {
    side.declareCustomRoll({
      shouldTransform: () => true,
      createGenerator: meldPerUnitPmf,
    })
  }
}

// Twilight's Fall action card. "When a die is rolled by any player: Roll two
// dice instead and add them together (max 10)." Modeled as a distribution
// transform on every die of BOTH sides while enabled — combat rolls and unit
// ability rolls (AFB / Space Cannon / Bombardment) alike. Implemented via the
// kernel's CUSTOM_ROLL declaration, replacing each entry's natural binomial
// with Binomial(dice, P(2d10 capped at 10 ≥ hit value)).
//
// Limitation: post-roll face-level effects (±1 conditional flips, rerolls)
// still assume uniform d10 faces, so stacking them on melded dice is
// approximate.
export const meld: Ability = {
  key: 'TF_MELD',
  name: 'Meld',
  description:
    'When a die is rolled by any player: Roll two dice instead and add them together (max 10).',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'REROLL_DICE_ROLL',
      call: declareMeld,
    },
    {
      timing: 'REROLL_UNIT_ABILITY_ROLL',
      call: declareMeld,
    },
  ],
}
