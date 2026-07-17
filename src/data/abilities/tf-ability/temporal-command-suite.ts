import { z } from 'zod/mini'

import type { Ability } from '@/combat'

type Params = {
  genomeKey: string
}

const NONE = 'none'

/**
 * Twilight's Fall Abilities-deck card (from the Nomad's kit). The TI4
 * Temporal Command Suite readies agents; the TF version readies genomes.
 * `uses` is the number of command tokens the player will spend — each one
 * re-readies the chosen genome once. The extra uses are pre-granted at
 * PREPARE, which is math-equivalent to readying the genome again after each
 * exhaust. Built via a factory so the genome deck is injected lazily at
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
    paramsSchema: z.object({ genomeKey: z.string() }),
    params: {
      isEnabled: true,
      uses: 0,
      genomeKey: NONE,
    },
    headerUI: 'uses',
    uiConfig: () => [
      {
        key: 'genomeKey',
        label: 'Genome',
        type: 'select',
        items: [
          { label: 'None', value: NONE },
          ...getGenomes().map(g => ({ label: g.name, value: g.key })),
        ],
      },
    ],
    invoke: [
      {
        // system: the card's `uses` is a config input (tokens to spend), not
        // a dispatch budget — gate manually and never auto-decrement.
        timing: 'PREPARE',
        system: true,
        isCallable: params => params.uses > 0 && params.genomeKey !== NONE,
        call: (ctx, params) => {
          const genome = getGenomes().find(g => g.key === params.genomeKey)
          if (!genome) return
          ctx.api.own.updateAbilityConfig(genome.key, {
            uses: (current: unknown) =>
              typeof current === 'number' ? current + params.uses : params.uses,
          })
        },
      },
    ],
  }
}
