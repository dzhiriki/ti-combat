import { z } from 'zod/mini'

import { type Ability } from '@/combat'

type Params = {
  safeReroll: boolean
}

declare global {
  interface AbilityConfigMap {
    CROWN_OF_THALNOS: Params
  }
}

/** Per-unit PMF for Crown's safe-reroll path. Inputs: the entry's hit value
 *  and `dpu` dice per unit. Output: length `dpu+1` PMF (`out[j]` = P(j hits)).
 *
 *  hv <= 2: rerolled misses are auto-hits, so the unit always lands `dpu`
 *  hits — even when the natural roll produced 0 hits, the reroll is safe.
 *
 *  hv  > 2: roll naturally; commit the reroll only when the natural roll
 *  produced ≥ 1 hit (otherwise the unit would risk destruction). Closed
 *  form:
 *    P(0) = (1 − p)^n
 *    P(j) = Σ_{k=1..min(j,n)} C(n,k) p^k (1−p)^(n−k)
 *                            · C(n−k, j−k) p'^(j−k) (1−p')^(n−j)
 *  with p = (11−hv)/10 and p' = p + 0.1. */
function crownSafePerUnitPmf(hitValue: number, dpu: number): number[] {
  const out = new Array<number>(dpu + 1).fill(0)
  if (dpu === 0) {
    out[0] = 1
    return out
  }
  if (hitValue <= 2) {
    out[dpu] = 1
    return out
  }
  const p = (11 - hitValue) / 10
  const pPrime = p + 0.1
  out[0] = Math.pow(1 - p, dpu)
  for (let j = 1; j <= dpu; j++) {
    let sum = 0
    const kMax = Math.min(j, dpu)
    for (let k = 1; k <= kMax; k++) {
      const natural =
        binomCoeff(dpu, k) * Math.pow(p, k) * Math.pow(1 - p, dpu - k)
      const reroll =
        binomCoeff(dpu - k, j - k) *
        Math.pow(pPrime, j - k) *
        Math.pow(1 - pPrime, dpu - j)
      sum += natural * reroll
    }
    out[j] = sum
  }
  return out
}

function binomCoeff(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
  return r
}

export const crownOfThalnos: Ability<Params> = {
  key: 'CROWN_OF_THALNOS',
  name: 'The Crown of Thalnos',
  description:
    "During each combat round, this card's owner may reroll any number of their dice, applying +1 to the results; any units that reroll dice but do not produce at least 1 hit are destroyed.",
  paramsSchema: z.object({
    safeReroll: z.boolean(),
  }),
  params: {
    isEnabled: false,
    uses: Infinity,
    safeReroll: true,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'REROLL_DICE_ROLL',
      call: (ctx, params) => {
        if (params.safeReroll) {
          ctx.api.own.declareCustomRoll({
            shouldTransform: (hitValue, dpu) => hitValue === 2 || dpu > 1,
            createGenerator: crownSafePerUnitPmf,
          })
        }
      },
    },
  ],
}
