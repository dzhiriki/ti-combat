import { z } from 'zod/mini'

import type {
  Ability,
  AbilityReadContext,
} from '@/combat/abilities-engine/types'

type Params = {
  agentKey: string
}

export const temporalCommandSuite: Ability<Params> = {
  key: 'TEMPORAL_COMMAND_SUITE',
  name: 'Temporal Command Suite',
  description:
    "After any player's agent becomes exhausted, you may exhaust this card to ready that agent; if you ready another player's agent, you may perform a transaction with that player.",
  paramsSchema: z.object({ agentKey: z.string() }),
  params: {
    isEnabled: false,
    uses: 1,
    agentKey: '',
  },
  headerUI: 'isEnabled',
  uiConfig: ctx => {
    const ownAgents = ctx.abilities.own.get('AGENT')
    return [
      {
        key: 'agentKey',
        label: 'Agent',
        type: 'select',
        items: ownAgents.map(a => ({ label: a.name, value: a.key })),
      },
    ]
  },
  invoke: [
    {
      timing: 'PREPARE',
      external: true,
      isCallable: (params, ctx) =>
        params.agentKey !== '' && findAgent(ctx, params.agentKey) !== undefined,
      call: (ctx, params) => {
        const agent = findAgent(ctx, params.agentKey)
        if (!agent) return

        const { uses: defaultUses } = ctx.api.own.getAbilityConfig(
          agent.key as keyof AbilityConfigMap,
        )

        ctx.api.own.updateAbilityConfig(agent.key, {
          uses: (current: unknown) =>
            (typeof current === 'number' ? current : defaultUses) + 1,
        })
      },
    },
  ],
}

function findAgent(ctx: AbilityReadContext, key: string): Ability | undefined {
  return ctx.abilities.own.get('AGENT').find(a => a.key === key)
}
