import { z } from 'zod/mini'

import { extractDefaults, type RegisteredAbility } from '@/combat'
import { UNIT_LIMITS, UNIT_TYPES } from '@/constants/units'
import type { GameSystem } from '@/types'
import { GAME_SYSTEMS } from '@/utils/get-game-data'
import {
  DEFAULT_GAME_SYSTEM,
  getGameData,
  isGameSystem,
} from '@/utils/get-game-data'

import type { SerializedConfig } from './serialization'

const unitTypeSet = new Set<string>(UNIT_TYPES)

const baseAbilitySchema = z.object({
  isEnabled: z.optional(z.boolean()),
  uses: z.optional(z.union([z.number(), z.literal(Infinity)])),
})

export interface ValidationResult {
  config: SerializedConfig
  warnings: string[]
}

export function buildAbilityLookup(
  abilities: readonly RegisteredAbility[],
): Map<string, RegisteredAbility> {
  const map = new Map<string, RegisteredAbility>()
  for (const ability of abilities) {
    if (!map.has(ability.key)) {
      map.set(ability.key, ability)
    }
  }
  return map
}

/** Resolve an explicit or legacy serialized system before ability decoding. */
export function resolveSerializedGameSystem(raw: {
  g?: unknown
  af?: unknown
  df?: unknown
}): GameSystem {
  if (isGameSystem(raw.g)) return raw.g
  if (raw.g !== undefined) return DEFAULT_GAME_SYSTEM

  for (const key of [raw.af, raw.df]) {
    if (typeof key !== 'string' || key === 'NEUTRAL') continue
    const inferred = GAME_SYSTEMS.find(system =>
      Object.hasOwn(getGameData(system).factions, key),
    )
    if (inferred) return inferred
  }
  return DEFAULT_GAME_SYSTEM
}

export function validateSerializedConfig(
  raw: SerializedConfig | Record<string, unknown>,
): ValidationResult {
  const warnings: string[] = []

  // Version
  const v = raw.v === 2 ? (2 as const) : (1 as const)

  // Only legacy links (without a system) infer it from factions. An explicit
  // system is authoritative, including when both sides are Neutral.
  const system = resolveSerializedGameSystem(raw)
  if (raw.g !== undefined && !isGameSystem(raw.g)) {
    warnings.push(`Invalid game system reset to ${DEFAULT_GAME_SYSTEM}`)
  }
  const abilityLookup = buildAbilityLookup(getGameData(system).allAbilities)

  // Factions must belong to the selected system. Validate after inference so
  // an unknown legacy attacker doesn't hide a valid TF defender.
  const factions = getGameData(system).factions
  const validateFaction = (rawKey: unknown): string => {
    const key = String(rawKey ?? '')
    if (Object.hasOwn(factions, key)) return key
    warnings.push(
      `Faction "${key}" is not available in ${system}, reset to default`,
    )
    return getGameData(system).defaultFaction
  }
  const af = validateFaction(raw.af)
  const df = validateFaction(raw.df)

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

  const planetIds =
    v === 2 && Array.isArray(raw.p)
      ? [...new Set(raw.p.filter(isPlanetId))]
      : ['planet-1']
  if (planetIds.length === 0) planetIds.push('planet-1')
  const sp =
    v === 2 && typeof raw.sp === 'string' && planetIds.includes(raw.sp)
      ? raw.sp
      : planetIds[0]
  const e = v === 2 && raw.e === 'F' ? ('F' as const) : ('S' as const)
  const validSurfaceIds = new Set(['space', ...planetIds])
  const asu =
    v === 2
      ? validateSurfaceUnits(raw.asu, validSurfaceIds, warnings)
      : undefined
  const dsu =
    v === 2
      ? validateSurfaceUnits(raw.dsu, validSurfaceIds, warnings)
      : undefined

  // Abilities
  const aa = validateAbilities(raw.aa, abilityLookup, warnings)
  const da = validateAbilities(raw.da, abilityLookup, warnings)

  return {
    config: {
      v,
      g: system,
      af,
      df,
      m,
      au,
      du,
      ...(v === 2 && { e, p: planetIds, sp, asu, dsu }),
      aa,
      da,
    },
    warnings,
  }
}

function isPlanetId(value: unknown): value is string {
  return typeof value === 'string' && /^planet-[1-9]\d*$/.test(value)
}

function validateSurfaceUnits(
  raw: unknown,
  validSurfaceIds: ReadonlySet<string>,
  warnings: string[],
): NonNullable<SerializedConfig['asu']> {
  const result: NonNullable<SerializedConfig['asu']> = {}
  if (typeof raw !== 'object' || raw === null) return result
  for (const surfaceId of validSurfaceIds) result[surfaceId] = {}
  const remaining = { ...UNIT_LIMITS }
  for (const [surfaceId, units] of Object.entries(
    raw as Record<string, unknown>,
  )) {
    if (!validSurfaceIds.has(surfaceId)) {
      warnings.push(`Unknown surface "${surfaceId}" ignored`)
      continue
    }
    const validated = validateUnits(units, warnings)
    const kept: typeof validated = {}
    for (const [type, [count, upgraded]] of Object.entries(validated)) {
      const unitType = type as keyof typeof UNIT_LIMITS
      const allowed = Math.min(count, remaining[unitType])
      remaining[unitType] -= allowed
      if (allowed > 0) kept[type] = [allowed, upgraded]
    }
    result[surfaceId] = kept
  }
  return result
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
  abilityLookup: Map<string, RegisteredAbility>,
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
  ability: RegisteredAbility,
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
