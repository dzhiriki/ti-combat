export type Verdict = 'slower' | 'faster' | 'same'

export interface ScenarioComparison {
  name: string
  /** Median time per round, ms. */
  base: number
  head: number
  /** Median of per-round head/base ratios minus 1 (0.1 = 10% slower). */
  change: number
  /** 90% confidence interval for `change`. */
  interval: [number, number]
  verdict: Verdict
}

export function median(values: number[]): number {
  const sorted = values.toSorted((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Distribution-free confidence interval for the median: the k-th smallest and
 * k-th largest samples, with k chosen from the Binomial(n, 1/2) tail so the
 * interval covers the true median with probability >= `confidence`. With fewer
 * than 5 samples 90% is unreachable and this degrades to [min, max].
 */
export function medianInterval(
  values: number[],
  confidence = 0.9,
): [number, number] {
  const sorted = values.toSorted((a, b) => a - b)
  const n = sorted.length
  let k = 1
  let pmf = 2 ** -n
  let cdf = 0
  for (let j = 0; j < n / 2; j++) {
    cdf += pmf
    if (1 - 2 * cdf < confidence) break
    k = j + 1
    pmf *= (n - j) / (j + 1)
  }
  return [sorted[k - 1], sorted[n - k]]
}

/**
 * `base[i]` and `head[i]` come from the same round, run back to back, so their
 * ratio cancels out machine speed and slow drift (thermal, noisy neighbours).
 * A change is reported only when the whole interval is on one side of zero and
 * the median change exceeds `threshold`.
 */
export function compareScenario(
  name: string,
  base: number[],
  head: number[],
  threshold: number,
): ScenarioComparison {
  const ratios = base.map((b, i) => head[i] / b)
  const change = median(ratios) - 1
  const [low, high] = medianInterval(ratios)
  const interval: [number, number] = [low - 1, high - 1]

  let verdict: Verdict = 'same'
  if (interval[0] > 0 && change > threshold) verdict = 'slower'
  if (interval[1] < 0 && change < -threshold) verdict = 'faster'

  return {
    name,
    base: median(base),
    head: median(head),
    change,
    interval,
    verdict,
  }
}
