import type { CombatOutcome, CombatResult } from '@/combat'

/** Total probability of each winner across `outcomes`. */
export function getCombatResult(
  outcomes: readonly CombatOutcome[],
): CombatResult {
  const result: CombatResult = { attackerWin: 0, draw: 0, defenderWin: 0 }
  for (const o of outcomes) {
    switch (o.winner) {
      case 'attacker':
        result.attackerWin += o.probability
        break
      case 'defender':
        result.defenderWin += o.probability
        break
      case 'draw':
        result.draw += o.probability
        break
    }
  }
  return result
}
