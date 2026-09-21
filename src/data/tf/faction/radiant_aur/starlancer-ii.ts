import { z } from 'zod/mini'

import type { Ability, AbilityReadContext } from '@/combat'

type Params = {
  repairWhen: 'ANY' | 'HALF' | 'ALL'
}

function mechCounts(ctx: AbilityReadContext): {
  alive: number
  damaged: number
} {
  let alive = 0
  let damaged = 0
  for (const id of ctx.api.own.getUnits('MECH', { includeVariants: true })) {
    alive++
    if (ctx.api.own.getUnitState(id)?.isDamaged) damaged++
  }
  return { alive, damaged }
}

// Radiant Aur mech. At the start of each round of ground combat you may spend
// a strategy token to repair all of your mechs. Each repair costs 1 token, so
// the header is a uses counter — set it to the number of tokens you're willing
// to spend; one is consumed per round in which a repair actually happens.
// `repairWhen` withholds the token until the repair is worth it, measured
// against LIVING mechs (an absolute count would go stale as mechs die — a
// threshold of 3 becomes unreachable once only 2 survive): repair on any
// damage, once half the survivors are damaged, or only when every survivor
// is.
export const starlancerII: Ability<Params> = {
  key: 'TF_STARLANCER_II',
  name: 'Starlancer II',
  description:
    'At the start of each round of ground combat, you may spend 1 token from your strategy pool to repair all of your mechs.',
  context: 'GROUND',
  paramsSchema: z.object({
    repairWhen: z.string(),
  }),
  params: {
    isEnabled: true,
    uses: 0,
    repairWhen: 'ANY',
  },
  headerUI: 'uses',
  uiConfig: [
    {
      key: 'repairWhen',
      // Select rows put the label and the dropdown on one line and ellipsize
      // the label; the trigger is as wide as the selected option. Keep both
      // short.
      label: 'Repair when',
      type: 'select',
      items: [
        { label: 'Any damaged', value: 'ANY' },
        { label: 'Half or more damaged', value: 'HALF' },
        { label: 'All damaged', value: 'ALL' },
      ],
    },
  ],
  invoke: [
    {
      timing: 'START_OF_COMBAT_ROUND',
      context: 'GROUND_COMBAT',
      isCallable: (params, ctx) => {
        const { alive, damaged } = mechCounts(ctx)
        if (damaged === 0) return false
        if (params.repairWhen === 'ALL') return damaged === alive
        if (params.repairWhen === 'HALF') return damaged * 2 >= alive
        return true
      },
      call: ctx => {
        for (const id of ctx.api.own.getUnits('MECH', {
          includeVariants: true,
        })) {
          if (ctx.api.own.getUnitState(id)?.isDamaged) {
            ctx.api.own.modifyUnitState(id, { isDamaged: false })
          }
        }
      },
    },
  ],
}
