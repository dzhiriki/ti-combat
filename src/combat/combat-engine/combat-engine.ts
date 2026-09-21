import { CombatState } from '../combat-state/combat-state'
import { getInitialMetaPhase, isCombatMeta } from '../combat-state/phase-utils'
import type { MetaPhase } from '../combat-state/types'
import type { CombatOutcome } from '../types'
import {
  extractSurvivors,
  extractSurvivorsBySurface,
} from './utils/extract-survivors'
import type { OutcomeRecord } from './utils/types'

interface ExpansionResult {
  outcomes: OutcomeRecord
  // Probability mass that should be absorbed by an ancestor as a self-loop
  // when that ancestor finalizes. Keys are the ancestors' cache keys.
  deferred: Map<string, number>
}

interface EngineOptions {
  maxRounds?: number
  logStats?: boolean
}

const DEFAULT_MAX_ROUNDS = 1000

export class CombatEngine {
  private maxRounds: number
  private logStats: boolean

  constructor(options: EngineOptions = {}) {
    this.maxRounds = options.maxRounds ?? DEFAULT_MAX_ROUNDS
    this.logStats = options.logStats ?? false
  }

  simulate(initialState: CombatState): CombatOutcome[] {
    // Cache: a node's result is `(outcomes, deferred)` where `deferred[k]`
    // is probability mass that flows back to ancestor key `k` via cycles.
    // The result is ONLY valid when all `deferred` keys are still in flight
    // — they will absorb the deferred mass via self-loop redistribution
    // when each of them finalizes. Cache hit = cached entry's `deferred`
    // keys are all currently in-progress.
    const subtreeCache = new Map<string, ExpansionResult>()
    const inProgress = new Set<string>()

    /** Every deferred key still on the DFS stack, so those ancestors will
     *  absorb the mass themselves when they finalize. */
    const allDepsInProgress = (result: ExpansionResult): boolean => {
      for (const dep of result.deferred.keys()) {
        if (!inProgress.has(dep)) return false
      }
      return true
    }

    /**
     * Repair a cached entry whose deferred mass points at ancestors that have
     * since finalized.
     *
     * `deferred[k] = p` means "mass p re-enters ancestor k and continues from
     * there", so once k's own distribution is known,
     *
     *     value(v) = outcomes(v) + Sum_k deferred(v)[k] * value(k)
     *
     * resolves v without re-expanding its subtree. Deferred keys are always
     * strict DFS ancestors (they originate from `cycleTo`, which only fires
     * on keys currently in `inProgress`), so the recursion is well-founded;
     * `seen` guards against a malformed graph rather than an expected one.
     *
     * A fully resolved entry carries no deferred mass, making it
     * context-independent, so it replaces the cached entry and every later
     * lookup hits it directly — the repair is paid for at most once per state.
     * Returns null when the entry cannot be made usable here, in which case
     * the caller falls through to a full re-expansion.
     */
    const resolveEntry = (
      key: string,
      seen: Set<string>,
    ): ExpansionResult | null => {
      const entry = subtreeCache.get(key)
      if (!entry) return null
      // Substitutable as-is when it owes nothing, and equally when it owes
      // only to ancestors still in flight: folding it into the caller hands
      // that debt to those same ancestors, which is exactly where the mass
      // was already headed. Missing this case rejected 83% of repairs — a
      // dependency that was itself fine, just not yet unconditional.
      if (entry.deferred.size === 0 || allDepsInProgress(entry)) return entry
      if (seen.has(key)) return null
      seen.add(key)

      const outcomes: OutcomeRecord = new Map()
      for (const [k, o] of entry.outcomes) outcomes.set(k, { ...o })
      const deferred = new Map<string, number>()

      for (const [dep, mass] of entry.deferred) {
        // Still in flight: that ancestor will absorb the mass itself.
        const sub = inProgress.has(dep) ? null : resolveEntry(dep, seen)
        if (!sub) {
          deferred.set(dep, (deferred.get(dep) ?? 0) + mass)
          continue
        }
        for (const [k, o] of sub.outcomes) {
          const p = o.probability * mass
          const existing = outcomes.get(k)
          if (existing) existing.probability += p
          else outcomes.set(k, { ...o, probability: p })
        }
        // A partially resolved dependency can still owe mass further up.
        for (const [k, p] of sub.deferred) {
          deferred.set(k, (deferred.get(k) ?? 0) + p * mass)
        }
      }

      seen.delete(key)

      const result: ExpansionResult = { outcomes, deferred }
      if (deferred.size === 0) {
        subtreeCache.set(key, result)
        return result
      }
      // Anything left must still be in flight for this result to be usable.
      return allDepsInProgress(result) ? result : null
    }

    let nodes = 1
    let finalNodes = 1

    const mode = initialState.combatMode
    const initialMeta: MetaPhase = getInitialMetaPhase(mode)

    const expandNode = (
      state: CombatState,
      round: number,
      incomingMeta: MetaPhase,
    ): ExpansionResult | { cycleTo: string } => {
      let currentMeta = incomingMeta
      let cacheKey: string | null = null

      const enterCombatRound = ():
        | ExpansionResult
        | { cycleTo: string }
        | 'enter' => {
        round++
        const roundFlag = round <= 1 ? '1' : 'N'
        const key = `${roundFlag}|${state.getHash()}`

        // Cache hit only if all deferred-mass dependencies are still
        // in-progress (so they will absorb the deferred mass at their
        // finalization step). Otherwise the cached result would leak
        // probability into a context where no ancestor will resolve it.
        const cached = subtreeCache.get(key)
        if (cached) {
          let usable = true
          for (const dep of cached.deferred.keys()) {
            if (!inProgress.has(dep)) {
              usable = false
              break
            }
          }
          if (usable) {
            if (cacheKey) inProgress.delete(cacheKey)
            return cached
          }

          // Stale: some deferred dependency has finalized, so no ancestor is
          // left to absorb its mass. Substituting the resolved dependency
          // back in salvages the entry instead of re-expanding the subtree.
          const resolved = resolveEntry(key, new Set())
          if (resolved) {
            if (cacheKey) inProgress.delete(cacheKey)
            return resolved
          }
        }

        if (inProgress.has(key)) {
          if (cacheKey) inProgress.delete(cacheKey)
          return { cycleTo: key }
        }

        if (cacheKey) inProgress.delete(cacheKey)
        cacheKey = key
        inProgress.add(key)
        return 'enter'
      }

      const finalize = (
        result: ExpansionResult | { cycleTo: string },
      ): ExpansionResult | { cycleTo: string } => {
        if (cacheKey !== null) {
          // Self-absorb deferred mass routed back to this very node.
          // Equivalent to expanding the geometric self-loop at this level.
          if ('outcomes' in result) {
            const selfMass = result.deferred.get(cacheKey)
            if (selfMass !== undefined && selfMass < 1) {
              const scale = 1 / (1 - selfMass)
              for (const o of result.outcomes.values()) o.probability *= scale
              result.deferred.delete(cacheKey)
              if (result.deferred.size > 0) {
                // Other deferred entries are downstream of this absorption
                // and must scale with the same factor (they ride the same
                // probability mass).
                for (const [k, p] of result.deferred) {
                  result.deferred.set(k, p * scale)
                }
              }
            } else if (selfMass !== undefined) {
              // selfMass >= 1 — pathological; treat as a pure cycle.
              result.deferred.delete(cacheKey)
            }
            subtreeCache.set(cacheKey, result)
          }
          inProgress.delete(cacheKey)
          cacheKey = null
        }
        return result
      }

      if (!state.isFinished() && state.pendingSteps.length === 0) {
        if (state.data.winnerSide !== undefined) {
          state.loadEndScript(currentMeta)
        } else {
          if (isCombatMeta(currentMeta)) {
            const res = enterCombatRound()
            if (res !== 'enter') return finalize(res)
          }
          state.loadPhaseScript(currentMeta, round)
        }
      }

      while (true) {
        if (round > this.maxRounds) {
          console.warn(`Exceed ${this.maxRounds} rounds`)
        }
        if (state.isFinished() || round > this.maxRounds) {
          finalNodes++
          const leaf = makeLeafOutcome(state)
          return finalize({ outcomes: leaf, deferred: new Map() })
        }

        if (state.pendingSteps.length === 0) {
          const nextPhase = state.getNextPhase(currentMeta)
          if (nextPhase === 'COMPLETE') {
            state.loadEndScript(currentMeta)
            continue
          }
          currentMeta = nextPhase
          if (isCombatMeta(nextPhase)) {
            const res = enterCombatRound()
            if (res !== 'enter') return finalize(res)
          }
          state.loadPhaseScript(nextPhase, round)
          if (state.pendingSteps.length === 0) continue
        }

        const outcomes = state.advance()

        nodes += outcomes.length
        if (outcomes.length === 1 && outcomes[0].state === state) {
          continue
        }

        const merged: OutcomeRecord = new Map()
        const deferred = new Map<string, number>()

        for (const child of outcomes) {
          const r = expandNode(child.state, round, currentMeta)

          if ('cycleTo' in r) {
            deferred.set(
              r.cycleTo,
              (deferred.get(r.cycleTo) ?? 0) + child.probability,
            )
            continue
          }

          for (const [key, o] of r.outcomes) {
            const adjustedProb = o.probability * child.probability
            const existing = merged.get(key)
            if (existing) {
              existing.probability += adjustedProb
            } else {
              merged.set(key, {
                attackerData: o.attackerData,
                defenderData: o.defenderData,
                probability: adjustedProb,
                winnerSide: o.winnerSide,
              })
            }
          }

          for (const [k, p] of r.deferred) {
            deferred.set(k, (deferred.get(k) ?? 0) + p * child.probability)
          }
        }

        return finalize({ outcomes: merged, deferred })
      }
    }

    if (initialState.isFinished()) {
      return outcomeRecordToArray(makeLeafOutcome(initialState))
    }
    const result = expandNode(initialState, 0, initialMeta)
    if ('cycleTo' in result) return []
    if (this.logStats) {
      console.log('Unique states =', subtreeCache.size)
      console.log('Unique nodes =', nodes)
      console.log('Final nodes =', finalNodes)
    }
    return outcomeRecordToArray(result.outcomes)
  }
}

/** Build the leaf outcome for a finished (or maxRounds-aborted) state.
 *  `winnerSide` is normally derived when phase flow is exhausted, before the
 *  end script flips `isFinished`. The maxRounds escape hatch is the one path
 *  that reaches here without the end script, so fall back. */
function makeLeafOutcome(state: CombatState): OutcomeRecord {
  const winnerSide = state.data.winnerSide ?? 'draw'
  const key = state.getUnitsHash()
  const record: OutcomeRecord = new Map()
  record.set(key, {
    attackerData: state.data.attacker,
    defenderData: state.data.defender,
    probability: 1,
    winnerSide,
  })
  return record
}

function outcomeRecordToArray(record: OutcomeRecord): CombatOutcome[] {
  const results: CombatOutcome[] = []
  for (const [, o] of record) {
    const attacker = extractSurvivors(o.attackerData)
    const defender = extractSurvivors(o.defenderData)

    results.push({
      attacker,
      defender,
      attackerSurfaces: extractSurvivorsBySurface(o.attackerData),
      defenderSurfaces: extractSurvivorsBySurface(o.defenderData),
      winner: o.winnerSide,
      probability: o.probability,
    })
  }
  return results
}
