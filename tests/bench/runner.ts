// Entry point bundled once per source tree by `compare.ts` and run as a child
// process. Prints per-iteration timings (ms) for each scenario as JSON.

import path from 'node:path'

import { CombatEngine } from '@/combat'
import {
  buildCombatState,
  type CombatStateConfig,
} from '@/hooks/combat-setup/build-combat-state'

// Every file in ./scenarios is a scenario named after the file. Its default
// export is one combat config or a list of them. Size each at ~50–100ms so a
// compare run stays around a minute.
const modules = import.meta.glob<CombatStateConfig | CombatStateConfig[]>(
  './scenarios/*.ts',
  { eager: true, import: 'default' },
)
const scenarios = Object.fromEntries(
  Object.entries(modules).map(([file, config]) => [
    path.basename(file, '.ts'),
    [config].flat(),
  ]),
)

export interface RunnerOptions {
  names: string[]
  warmup: number
  iterations: number
}

export type RunnerResult = Record<string, number[]>

function runScenario(configs: CombatStateConfig[]) {
  for (const config of configs) {
    new CombatEngine().simulate(buildCombatState(config))
  }
}

const options: RunnerOptions = JSON.parse(process.argv[2])
const result: RunnerResult = {}

// Warm up everything before measuring anything: scenarios share most engine
// code, so otherwise the first one measured absorbs the JIT tier-up.
for (let i = 0; i < options.warmup; i++) {
  for (const name of options.names) runScenario(scenarios[name])
}

for (const name of options.names) {
  const configs = scenarios[name]
  const samples: number[] = []
  for (let i = 0; i < options.iterations; i++) {
    const start = performance.now()
    runScenario(configs)
    samples.push(performance.now() - start)
  }
  result[name] = samples
}

process.stdout.write(JSON.stringify(result))
