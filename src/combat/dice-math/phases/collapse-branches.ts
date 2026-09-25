import type {
  DiceMathBranch,
  PendingEffect,
  PendingHitPool,
} from '../branch-accumulator'

/**
 * Merge branches whose `pendingHitPool`, `usesDelta`, and
 * `pendingEffects` collapse to the same identity key. Probabilities sum.
 *
 * pendingEffects MUST match when keys match — they're derived purely
 * from the key components, so a mismatch is a kernel bug. We assert
 * payload structure equality defensively.
 */
export function collapseBranches(branches: DiceMathBranch[]): DiceMathBranch[] {
  const byKey = new Map<string, DiceMathBranch>()
  for (const acc of branches) {
    const key = identityKey(acc)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, {
        probability: acc.probability,
        pendingHitPool: acc.pendingHitPool,
        usesDelta: acc.usesDelta,
        pendingEffects: acc.pendingEffects,
      })
      continue
    }
    if (!effectsMatch(existing.pendingEffects, acc.pendingEffects)) {
      throw new Error(
        'collapseBranches: pendingEffects mismatch for identical branch key',
      )
    }
    existing.probability += acc.probability
  }
  return Array.from(byKey.values())
}

function identityKey(acc: DiceMathBranch): string {
  const a = serializePool(acc.pendingHitPool.attacker)
  const d = serializePool(acc.pendingHitPool.defender)
  const u = serializeUsesDelta(acc.usesDelta)
  const e = serializeEffects(acc.pendingEffects)
  return `${a}|${d}|${u}|${e}`
}

function serializeEffects(effects: PendingEffect[]): string {
  return effects.map(serializeEffect).join('@')
}

function serializeEffect(e: PendingEffect): string {
  const payload = e.payload as { count: number }
  return `n:${e.abilityKey}:${e.slotId}:${e.side}:${payload.count}`
}

function serializePool(pool: PendingHitPool): string {
  if (pool.custom.length === 0) return `${pool.base}`
  const custom = pool.custom
    .map(c => `${c.key}=${c.base}@${c.unitPriority.join(',')}`)
    .join(';')
  return `${pool.base}|${custom}`
}

function serializeUsesDelta(map: Map<string, number>): string {
  const keys = Array.from(map.keys()).sort()
  return keys.map(k => `${k}=${map.get(k)!}`).join(',')
}

function effectsMatch(
  a: DiceMathBranch['pendingEffects'],
  b: DiceMathBranch['pendingEffects'],
): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    if (
      x.abilityKey !== y.abilityKey ||
      x.slotId !== y.slotId ||
      x.side !== y.side
    ) {
      return false
    }
  }
  return true
}
