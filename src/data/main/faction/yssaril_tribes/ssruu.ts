import { z } from 'zod/mini'

import yssarilTribesIcon from '@/assets/faction/yssaril_tribes.svg?raw'
import { extractDefaults } from '@/combat/abilities-engine/declare-param'
import type {
  Ability,
  AbilityCallContext,
  AbilityInvoke,
  AbilityReadContext,
  SelectItem,
} from '@/combat/abilities-engine/types'

import { otherFactions } from '../other-factions'

type Params = {
  agentKey: string
  [key: string]: unknown
}

export const ssruu: Ability<Params> = {
  key: 'SSRUU',
  name: 'Ssruu',
  description:
    "This card has the text ability of each other player's agent, even if that agent is exhausted.",
  icon: yssarilTribesIcon,
  paramsSchema: z.object({ agentKey: z.string() }),
  params: {
    isEnabled: false,
    uses: 1,
    agentKey: 'none',
  },
  headerUI: 'isEnabled',
  onParamSet: (params, key) => {
    // When the agent switches, overlay the new agent's defaults onto Ssruu's
    // params so UI controls start with the wrapped agent's defaults rather
    // than stale values left over from a previously selected agent.
    if (key !== 'agentKey') return
    const agent = getAgents().find(a => a.key === params.agentKey)
    if (!agent) return params
    const defaults = extractDefaults(agent)
    const next = { ...params } as Record<string, unknown>
    for (const k of Object.keys(defaults)) {
      if (k === 'isEnabled' || k === 'uses') continue
      next[k] = defaults[k]
    }
    return next as typeof params
  },
  declareParamChange: (params, settings) => {
    const agent = getAgents().find(a => a.key === params.agentKey)
    if (!agent?.declareParamChange) return []
    const merged = withAgentDefaults(agent, params)
    return agent.declareParamChange(
      merged as Parameters<NonNullable<Ability['declareParamChange']>>[0],
      settings,
    )
  },
  declareSubtype: params => {
    const agent = getAgents().find(a => a.key === params.agentKey)
    if (!agent?.declareSubtype) return []
    const merged = withAgentDefaults(agent, params as Params)
    return agent.declareSubtype(
      merged as Parameters<NonNullable<Ability['declareSubtype']>>[0],
    )
  },
  uiConfig: (ctx, params) => {
    const agents = getAgents()
    const selectItem = {
      key: 'agentKey',
      label: 'Agent',
      type: 'select',
      items: [
        { label: 'None', value: 'none' },
        ...agents.map(a => ({ label: a.name, value: a.key })),
      ] as SelectItem[],
    } as const
    const agent = agents.find(a => a.key === params.agentKey)
    if (!agent?.uiConfig) return [selectItem]
    const merged = withAgentDefaults(agent, params)
    const agentItems =
      typeof agent.uiConfig === 'function'
        ? agent.uiConfig(
            ctx,
            merged as Parameters<
              Extract<typeof agent.uiConfig, (...args: unknown[]) => unknown>
            >[1],
          )
        : agent.uiConfig
    return [selectItem, ...agentItems]
  },
  invoke: getAgents().flatMap(agent =>
    agent.invoke.map(
      inv => wrapInvoke(agent, inv as AbilityInvoke) as AbilityInvoke<Params>,
    ),
  ),
}

function getAgents(): Ability[] {
  return Object.values(otherFactions).flatMap(
    faction => (faction.abilities?.agent ?? []) as Ability[],
  )
}

/** Overlay the wrapped agent's defaults on Ssruu's params so every param
 *  the agent expects is defined, without baking a spread of every agent's
 *  defaults into Ssruu's base params. */
function withAgentDefaults(
  agent: Ability,
  params: Params,
): Record<string, unknown> {
  return { ...extractDefaults(agent), ...params }
}

type GenericIsCallable = (
  p: unknown,
  c: AbilityReadContext,
  extra?: unknown,
) => boolean
type GenericCall = (
  c: AbilityCallContext,
  p: unknown,
  extra?: unknown,
) => unknown

function wrapInvoke(agent: Ability, invoke: AbilityInvoke) {
  return {
    ...invoke,
    isCallable: (params: Params, ctx: AbilityReadContext, extra?: unknown) => {
      if (params.agentKey !== agent.key) return false
      const merged = withAgentDefaults(agent, params)
      const isCallable = invoke.isCallable as GenericIsCallable | undefined
      return !isCallable || isCallable(merged, ctx, extra)
    },
    call: (ctx: AbilityCallContext, params: Params, extra?: unknown) => {
      if (params.agentKey !== agent.key) return
      const merged = withAgentDefaults(agent, params)
      ;(invoke.call as GenericCall)(ctx, merged, extra)
    },
  }
}
