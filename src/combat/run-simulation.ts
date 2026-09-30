import { prepareSimulation } from '@/hooks/combat-setup'
import type { SimulationInput } from '@/hooks/combat-setup/types'

import { CombatEngine } from './combat-engine'
import { CombatState } from './combat-state'

/**
 * The simulation worker's job, kept out of the worker so tests can call it:
 * the worker binds `self.onmessage` on import, which a no-isolate test run
 * does once per thread, not once per file.
 */
export function runSimulation({ precision, ...input }: SimulationInput) {
  const combatState = CombatState.forSimulation({
    ...prepareSimulation(input),
    collapseThreshold:
      precision?.kind === 'limited' ? 10 ** -precision.digits : undefined,
  })

  const engine = new CombatEngine({
    logStats: true,
  })
  console.time('Simulate')
  const outcomes = engine.simulate(combatState)
  console.timeEnd('Simulate')
  console.log('Outcomes', outcomes)
  return outcomes
}
