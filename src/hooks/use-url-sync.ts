import { useEffect, useRef } from 'react'

import { type Ability, extractDefaults } from '@/combat'
import { getGameData } from '@/utils/get-game-data'

import type { SerializedConfig } from './combat-setup/serialization'
import {
  buildAbilityLookup,
  resolveSerializedGameSystem,
  validateSerializedConfig,
} from './combat-setup/validation'

// ── Encode: SerializedConfig → query string ─────────────────────────

export function configToSearchString(config: SerializedConfig): string {
  const parts: string[] = [
    `v=${config.v}`,
    `g=${config.g}`,
    `af=${config.af}`,
    `df=${config.df}`,
    `m=${config.m}`,
  ]

  for (const [type, [count, upgraded]] of Object.entries(config.au)) {
    parts.push(`au.${type}=${count}.${upgraded}`)
  }
  for (const [type, [count, upgraded]] of Object.entries(config.du)) {
    parts.push(`du.${type}=${count}.${upgraded}`)
  }

  writeAbilityParams(parts, 'aa', config.aa)
  writeAbilityParams(parts, 'da', config.da)

  return parts.join('&')
}

function writeAbilityParams(
  parts: string[],
  prefix: string,
  abilities: Record<string, Record<string, unknown>>,
): void {
  for (const [key, params] of Object.entries(abilities)) {
    for (const [pk, pv] of Object.entries(params)) {
      parts.push(`${prefix}.${key}.${pk}=${encodeValue(pv)}`)
    }
  }
}

function encodeValue(value: unknown): string {
  if (value === Infinity) return 'Inf'
  if (value === true) return 'true'
  if (value === false) return 'false'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    // Tuple arrays `[K, V][]` (UnitList<number>, UnitList<boolean>) — encode
    // each tuple as `key~val` so we can distinguish from a flat string array
    // at decode time. Single-element tuples / flat arrays use plain `,`.
    if (value.length > 0 && Array.isArray(value[0]) && value[0].length >= 2) {
      return value
        .map(t => (t as unknown[]).map(encodeScalar).join('~'))
        .join(',')
    }
    return value.join(',')
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}~${v}`)
      .join(',')
  }
  return String(value)
}

function encodeScalar(v: unknown): string {
  if (v === Infinity) return 'Inf'
  if (v === true) return 'true'
  if (v === false) return 'false'
  return String(v)
}

// ── Decode: query string → raw config object ────────────────────────

export function searchParamsToConfig(search: string): Record<string, unknown> {
  const params = new URLSearchParams(search)
  const system = resolveSerializedGameSystem({
    ...(params.has('g') && { g: params.get('g') }),
    af: params.get('af'),
    df: params.get('df'),
  })
  const abilityLookup = buildAbilityLookup(getGameData(system).allAbilities)
  const au: Record<string, [number, 0 | 1]> = {}
  const du: Record<string, [number, 0 | 1]> = {}
  const aa: Record<string, Record<string, unknown>> = {}
  const da: Record<string, Record<string, unknown>> = {}

  for (const [key, value] of params) {
    if (key.startsWith('au.')) {
      const type = key.slice(3)
      const [count, upgraded] = value.split('.')
      au[type] = [Number(count), Number(upgraded) as 0 | 1]
    } else if (key.startsWith('du.')) {
      const type = key.slice(3)
      const [count, upgraded] = value.split('.')
      du[type] = [Number(count), Number(upgraded) as 0 | 1]
    } else if (key.startsWith('aa.') || key.startsWith('da.')) {
      const isAttacker = key.startsWith('aa.')
      const rest = key.slice(3)
      const dotIdx = rest.indexOf('.')
      if (dotIdx === -1) continue
      const abilityKey = rest.slice(0, dotIdx)
      const paramKey = rest.slice(dotIdx + 1)
      const target = isAttacker ? aa : da
      if (!target[abilityKey]) target[abilityKey] = {}
      target[abilityKey][paramKey] = decodeValue(
        value,
        abilityLookup.get(abilityKey),
        paramKey,
      )
    }
  }

  return {
    v: Number(params.get('v') ?? 1),
    ...(params.has('g') && { g: params.get('g') }),
    af: params.get('af') ?? '',
    df: params.get('df') ?? '',
    m: params.get('m') ?? 'S',
    au,
    du,
    aa,
    da,
  }
}

function decodeValue(
  raw: string,
  ability: Ability | undefined,
  paramKey: string,
): unknown {
  // Base params — always known types regardless of ability lookup
  if (paramKey === 'isEnabled') return raw === 'true'
  if (paramKey === 'uses') return raw === 'Inf' ? Infinity : Number(raw)

  if (!ability) return raw

  const defaults = extractDefaults(ability)
  const defaultValue = defaults[paramKey]

  if (typeof defaultValue === 'boolean') return raw === 'true'
  if (typeof defaultValue === 'number')
    return raw === 'Inf' ? Infinity : Number(raw)
  if (typeof defaultValue === 'string') return raw
  if (Array.isArray(defaultValue)) {
    if (raw === '') return []
    const entries = raw.split(',')
    // Tuple-array encoding uses `~` between tuple elements; if any entry
    // contains `~`, parse as `[K, V][]` (UnitList<number>/<boolean>).
    if (entries.some(e => e.includes('~'))) {
      return entries.map(e => {
        const idx = e.indexOf('~')
        return [e.slice(0, idx), decodeScalar(e.slice(idx + 1))]
      })
    }
    return entries
  }
  if (typeof defaultValue === 'object' && defaultValue !== null) {
    if (raw === '') return {}
    const result: Record<string, number> = {}
    for (const entry of raw.split(',')) {
      const tildeIdx = entry.indexOf('~')
      if (tildeIdx === -1) continue
      result[entry.slice(0, tildeIdx)] = Number(entry.slice(tildeIdx + 1))
    }
    return result
  }
  return raw
}

function decodeScalar(s: string): unknown {
  if (s === 'true') return true
  if (s === 'false') return false
  if (s === 'Inf') return Infinity
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s)
  return s
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useUrlSync(
  serializedConfig: SerializedConfig,
  loadConfig: (config: SerializedConfig) => void,
  toast: (message: string) => void,
): void {
  const loadedRef = useRef(false)
  const initialConfigRef = useRef(serializedConfig)

  // Read URL on mount (one-time)
  useEffect(() => {
    const search = window.location.search
    if (!search || search === '?') {
      loadedRef.current = true
      return
    }

    try {
      const raw = searchParamsToConfig(search)
      const { config, warnings } = validateSerializedConfig(raw)
      loadConfig(config)
      if (warnings.length > 0) {
        toast(warnings.join('; '))
      }
    } catch {
      toast('Invalid config link')
    } finally {
      loadedRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Write URL on config change — skip until user makes a change
  useEffect(() => {
    if (!loadedRef.current) return
    if (serializedConfig === initialConfigRef.current) return
    initialConfigRef.current = undefined!

    const search = configToSearchString(serializedConfig)
    history.replaceState(null, '', `${window.location.pathname}?${search}`)
  }, [serializedConfig])
}
