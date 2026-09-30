import type { SimulationInput } from '@/hooks/combat-setup/types'

import { runSimulation } from './run-simulation'

self.onmessage = (e: MessageEvent<SimulationInput>) => {
  self.postMessage(runSimulation(e.data))
}
