import { z } from 'zod/mini'

import { type Ability, extractDefaults } from '@/combat'
import { UNIT_LIMITS, UNIT_TYPES } from '@/constants/units'
import * as main from '@/data/main'
import * as tf from '@/data/tf'

import type { SerializedConfig } from './serialization'

// TI4 first so the fallback faction is TI4's default.
const factionKeySet = new Set<string>([
  ...Object.keys(main.factions),
  ...Object.keys(tf.factions),
])
const factionKeys = [...factionKeySet]
const unitTypeSet = new Set<string>(UNIT_TYPES)
const defaultFaction = factionKeys[0]

const baseAbilitySchema = z.object({
  isEnabled: z.optional(z.boolean()),
  uses: z.optional(z.union([z.number(), z.literal(Infinity)])),
})

export interface ValidationResult {
  config: SerializedConfig
  warnings: string[]
}

export function buildAbilityLookup(abilities: Ability[]): Map<string, Ability> {
  const map = new Map<string, Ability>()
  for (const ability of abilities) {
    if (!map.has(ability.key)) {
      map.set(ability.key, ability)
    }
  }
  return map
}

export function validateSerializedConfig(
  raw: SerializedConfig | Record<string, unknown>,
  abilityLookup: Map<string, Ability>,
): ValidationResult {
  const warnings: string[] = []

  // Version
  const v = 1 as const

  // Factions
  let af = String(raw.af ?? '')
  if (!factionKeySet.has(af)) {
    warnings.push(`Unknown faction "${af}" reset to default`)
    af = defaultFaction
  }
  let df = String(raw.df ?? '')
  if (!factionKeySet.has(df)) {
    warnings.push(`Unknown faction "${df}" reset to default`)
    df = defaultFaction
  }

  // Combat mode
  let m: 'S' | 'G' = 'S'
  if (raw.m === 'S' || raw.m === 'G') {
    m = raw.m
  } else {
    warnings.push('Invalid combat mode reset to Space')
  }

  // Units
  const au = validateUnits(raw.au, warnings)
  const du = validateUnits(raw.du, warnings)

  // Abilities
  const aa = validateAbilities(raw.aa, abilityLookup, warnings)
  const da = validateAbilities(raw.da, abilityLookup, warnings)

  return {
    config: { v, af, df, m, au, du, aa, da } as SerializedConfig,
    warnings,
  }
}

function validateUnits(
  raw: unknown,
  warnings: string[],
): Record<string, [number, 0 | 1]> {
  const result: Record<string, [number, 0 | 1]> = {}
  if (typeof raw !== 'object' || raw === null) return result

  for (const [type, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!unitTypeSet.has(type)) {
      warnings.push(`Unknown unit type "${type}" ignored`)
      continue
    }
    if (!Array.isArray(value) || value.length < 2) continue
    const limit = UNIT_LIMITS[type as keyof typeof UNIT_LIMITS] ?? 99
    const count = Math.min(Math.max(0, Math.floor(Number(value[0]))), limit)
    const upgraded = value[1] === 1 ? 1 : 0
    if (count > 0) {
      result[type] = [count, upgraded as 0 | 1]
    }
  }
  return result
}

function validateAbilities(
  raw: unknown,
  abilityLookup: Map<string, Ability>,
  warnings: string[],
): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {}
  if (typeof raw !== 'object' || raw === null) return result

  for (const [key, params] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof params !== 'object' || params === null) continue
    const paramsObj = params as Record<string, unknown>

    const ability = abilityLookup.get(key)
    if (!ability) {
      warnings.push(`Unknown ability "${key}" skipped`)
      continue
    }

    // Validate base params (optional since URL stores diffs only)
    const baseResult = baseAbilitySchema.safeParse(paramsObj)
    if (!baseResult.success) {
      warnings.push(`Ability "${ability.name}" has invalid params, skipped`)
      continue
    }

    // Schema-validate the URL diff merged onto defaults so malformed
    // values surface a warning instead of silently corrupting the
    // ability config (e.g. a tuple-array param decoded as flat strings).
    if (ability.paramsSchema) {
      const merged = mergeWithDefaults(ability, paramsObj)
      const customResult = ability.paramsSchema.safeParse(merged)
      if (!customResult.success) {
        warnings.push(`Ability "${ability.name}" has invalid params, skipped`)
        continue
      }
    }

    result[key] = paramsObj
  }
  return result
}

function mergeWithDefaults(
  ability: Ability,
  params: Record<string, unknown>,
): Record<string, unknown> {
  const defaults = extractDefaults(ability)
  const merged: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(defaults)) {
    if (k === 'isEnabled' || k === 'uses') continue
    merged[k] = v
  }
  for (const [k, v] of Object.entries(params)) {
    if (k === 'isEnabled' || k === 'uses') continue
    merged[k] = v
  }
  return merged
}
