import { prepareSimulation } from '@/hooks/combat-setup'
import type { SimulationInput } from '@/hooks/combat-setup/types'

import { CombatEngine } from './combat-engine'
import { CombatState } from './combat-state'

self.onmessage = (e: MessageEvent<SimulationInput>) => {
  const { precision, ...input } = e.data
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

  self.postMessage(outcomes)
}
