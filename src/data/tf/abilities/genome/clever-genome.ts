import { z } from 'zod/mini'

import type { Ability, AbilityCallContext, AbilityReadContext } from '@/combat'
import { extractDefaults } from '@/combat'
import type { AbilityInvoke, SelectItem } from '@/combat/abilities-engine/types'

type Params = {
  genomeKey: string
  [key: string]: unknown
}

const NONE = 'none'

/**
 * Twilight's Fall Clever Genome — the TF Ssruu: it copies the text of another
 * genome from the shared Genomes deck, the way Ssruu copies another faction's
 * agent. Modeled identically to Ssruu: a dropdown picks the genome, every
 * genome's invokes are wrapped with a guard on the selected key, and the
 * wrapped genome's params are overlaid so its UI controls work through this
 * card. Built via a factory so the deck list is injected at registration time
 * (avoids import cycles between the shared deck and this card).
 */
export function createCleverGenome(
  genomes: readonly Ability[],
): Ability<Params> {
  return {
    key: 'TF_CLEVER_GENOME',
    name: 'Clever Genome',
    description: 'This card has the text ability of 1 other genome.',
    paramsSchema: z.object({ genomeKey: z.string() }),
    params: {
      isEnabled: false,
      uses: 1,
      genomeKey: NONE,
    },
    headerUI: 'isEnabled',
    onParamSet: (params, key) => {
      // When the genome switches, overlay the new genome's defaults onto this
      // card's params so UI controls start with the wrapped genome's defaults
      // rather than stale values left over from a previous selection.
      if (key !== 'genomeKey') return
      const genome = genomes.find(g => g.key === params.genomeKey)
      if (!genome) return params
      const defaults = extractDefaults(genome)
      const next = { ...params } as Record<string, unknown>
      for (const k of Object.keys(defaults)) {
        if (k === 'isEnabled' || k === 'uses') continue
        next[k] = defaults[k]
      }
      return next as typeof params
    },
    declareParamChange: (params, settings) => {
      const genome = genomes.find(g => g.key === params.genomeKey)
      if (!genome?.declareParamChange) return []
      const merged = withGenomeDefaults(genome, params)
      return genome.declareParamChange(
        merged as Parameters<NonNullable<Ability['declareParamChange']>>[0],
        settings,
      )
    },
    declareSubtype: params => {
      const genome = genomes.find(g => g.key === params.genomeKey)
      if (!genome?.declareSubtype) return []
      const merged = withGenomeDefaults(genome, params as Params)
      return genome.declareSubtype(
        merged as Parameters<NonNullable<Ability['declareSubtype']>>[0],
      )
    },
    uiConfig: (ctx, params) => {
      const selectItem = {
        key: 'genomeKey',
        label: 'Genome',
        type: 'select',
        items: [
          { label: 'None', value: NONE },
          ...genomes.map(g => ({ label: g.name, value: g.key })),
        ] as SelectItem[],
      } as const
      const genome = genomes.find(g => g.key === params.genomeKey)
      if (!genome?.uiConfig) return [selectItem]
      const merged = withGenomeDefaults(genome, params)
      const genomeItems =
        typeof genome.uiConfig === 'function'
          ? genome.uiConfig(
              ctx,
              merged as Parameters<
                Extract<typeof genome.uiConfig, (...args: unknown[]) => unknown>
              >[1],
            )
          : genome.uiConfig
      return [selectItem, ...genomeItems]
    },
    invoke: genomes.flatMap(genome =>
      genome.invoke.map(
        inv =>
          wrapInvoke(genome, inv as AbilityInvoke) as AbilityInvoke<Params>,
      ),
    ),
  }
}

/** Overlay the wrapped genome's defaults on this card's params so every param
 *  the genome expects is defined, without baking a spread of every genome's
 *  defaults into the base params. */
function withGenomeDefaults(
  genome: Ability,
  params: Params,
): Record<string, unknown> {
  return { ...extractDefaults(genome), ...params }
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

function wrapInvoke(genome: Ability, invoke: AbilityInvoke) {
  return {
    ...invoke,
    // Genomes copied from agents (Altruistic/Aristocratic/Human) carry
    // external invokes, and an ability with ANY external invoke dispatches
    // ONLY external invokes on sides that don't own it (see
    // `passesCrossFactionFilter`). No TF faction owns this card, so every
    // wrapped invoke must be external or the non-agent genome copies
    // (Mirror/Splitting/Valiant) would silently never fire.
    external: true,
    isCallable: (params: Params, ctx: AbilityReadContext, extra?: unknown) => {
      if (params.genomeKey !== genome.key) return false
      const merged = withGenomeDefaults(genome, params)
      const isCallable = invoke.isCallable as GenericIsCallable | undefined
      return !isCallable || isCallable(merged, ctx, extra)
    },
    call: (ctx: AbilityCallContext, params: Params, extra?: unknown) => {
      if (params.genomeKey !== genome.key) return
      const merged = withGenomeDefaults(genome, params)
      ;(invoke.call as GenericCall)(ctx, merged, extra)
    },
  }
}
