import { z } from 'zod/mini'

import type { Ability } from '@/combat'
import type { UnitList } from '@/types'
import { UnitListNumberSchema } from '@/types'

type Params = {
  genomes: UnitList<number, string>
}

/**
 * Twilight's Fall Abilities-deck card (from the Nomad's kit). The TI4
 * Temporal Command Suite readies agents; the TF version spends command tokens
 * to ready genomes — any of them, repeatedly, including the same genome
 * several times. Each genome row therefore carries its own token count: the
 * number of times that genome is re-readied. The extra uses are pre-granted
 * at PREPARE, which is math-equivalent to readying the genome again after
 * each exhaust. Built via a factory so the genome deck is injected lazily at
 * registration time (avoids import cycles with the shared deck module).
 */
export function createTfTemporalCommandSuite(
  getGenomes: () => readonly Ability[],
): Ability<Params> {
  return {
    key: 'TF_TEMPORAL_COMMAND_SUITE',
    name: 'Temporal Command Suite',
    description:
      "After any player's genome becomes exhausted: You may spend 1 command token from any pool to ready that genome.",
    paramsSchema: z.object({ genomes: UnitListNumberSchema }),
    params: {
      isEnabled: false,
      uses: Infinity,
      genomes: [],
    },
    headerUI: 'isEnabled',
    uiConfig: () => [
      {
        key: 'genomes',
        label: 'Command tokens per genome',
        type: 'unit-list',
        mode: 'number',
        items: getGenomes().map(g => ({ label: g.name, value: g.key })),
      },
    ],
    invoke: [
      {
        // system: the per-genome counts are config inputs (tokens to
        // spend), not a dispatch budget — gate manually and never
        // auto-decrement.
        timing: 'PREPARE',
        system: true,
        isCallable: params =>
          params.isEnabled &&
          params.genomes.some(
            ([key, count]) =>
              count > 0 && getGenomes().some(g => g.key === key),
          ),
        call: (ctx, params) => {
          for (const [key, count] of params.genomes) {
            if (count <= 0) continue
            if (!getGenomes().some(g => g.key === key)) continue
            ctx.api.own.updateAbilityConfig(key, {
              uses: (current: unknown) =>
                typeof current === 'number' ? current + count : count,
            })
          }
        },
      },
    ],
  }
}
