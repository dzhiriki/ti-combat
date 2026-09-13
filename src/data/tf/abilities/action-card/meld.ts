import { z } from 'zod/mini'

import type { Ability, AbilityCallContext } from '@/combat'

type Params = {
  scope: 'COMBAT' | 'UNIT_ABILITY' | 'ALL'
}

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
 *  hitting with `meldHitProb` — Binomial(dpu, p). The kernel calls this with
 *  `dpu = 1` for the single melded die. */
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
  ctx.api.own.declareCustomRoll({
    shouldTransform: () => true,
    createGenerator: meldPerUnitPmf,
    singleDie: true,
  })
}

// Twilight's Fall action card. "When a die is rolled by any player: Roll two
// dice instead and add them together (max 10)." The card is played on ONE
// die (like Meddle's ±1): the kernel's singleDie CUSTOM_ROLL replaces one
// die's natural d10 with the melded distribution. Melding always raises the
// hit chance, and the gain grows with the hit value, so the die chosen is
// the own side's hardest-to-hit die (the kernel's highest-hit-value pick).
// A single card sits in the deck, so this is a one-shot toggle (uses: 1,
// billed by the kernel on the roll it melds); `scope` picks which rolls
// qualify (combat rolls by default, so an automatic AFB roll doesn't
// silently eat the card before the combat round).
//
// Limitation: post-roll face-level effects (±1 conditional flips, rerolls)
// still assume uniform d10 faces, so stacking them on a melded die is
// approximate.
export const meld: Ability<Params> = {
  key: 'TF_MELD',
  name: 'Meld',
  description:
    'When a die is rolled by any player: Roll two dice instead and add them together (max 10).',
  paramsSchema: z.object({ scope: z.string() }),
  params: {
    isEnabled: false,
    uses: 1,
    scope: 'COMBAT',
  },
  headerUI: 'isEnabled',
  uiConfig: [
    {
      key: 'scope',
      label: 'Meld a die of',
      type: 'select',
      items: [
        { label: 'Combat rolls', value: 'COMBAT' },
        { label: 'Unit ability rolls', value: 'UNIT_ABILITY' },
        { label: 'All rolls', value: 'ALL' },
      ],
    },
  ],
  invoke: [
    {
      timing: 'REROLL_DICE_ROLL',
      declaration: true,
      // REROLL_* invokes skip dispatch-time `uses` gating (billing is
      // deferred to the kernel) — gate explicitly.
      isCallable: params =>
        params.isEnabled && params.uses > 0 && params.scope !== 'UNIT_ABILITY',
      call: declareMeld,
    },
    {
      timing: 'REROLL_UNIT_ABILITY_ROLL',
      declaration: true,
      isCallable: params =>
        params.isEnabled && params.uses > 0 && params.scope !== 'COMBAT',
      call: declareMeld,
    },
  ],
}
