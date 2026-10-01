import type { UnitCategory } from '@/constants/units'

import type { ParamLimit } from './param-limit'
import type {
  Ability,
  ParamFilter,
  SyncSortSpec,
  SyncSourceConfig,
  UnitSelectorScope,
  UnitSplit,
} from './types'

export type { ParamLimit } from './param-limit'

const DECLARED_PARAM = Symbol('declaredParam')

interface DeclaredParamOptions<T> {
  default: T
  /** Defaults to participating units; use system or type for other choices. */
  scope?: UnitSelectorScope
  source?: UnitCategory | readonly UnitCategory[]
  side?: 'own' | 'opponent'
  sort?: SyncSortSpec
  /** For `UnitList<V>` params, the value used when reconcile adds a new
   *  entry that has no parent in the current list (e.g. `false` for
   *  checkbox lists, `0` for number lists). Subtype variants
   *  (`DREADNOUGHT:Galvanized`) inherit their parent's value when the
   *  parent is present, falling back to this only when there is no
   *  parent. Omit for order-mode lists (single-element tuples). */
  defaultItemValue?: unknown
  /** Variant-list filter. Same shape as `getUnitVariantsOptions`'s filter
   *  argument — reconcile applies it to the synced valid list, and
   *  `getUnitVariantsOptions(paramKey)` reuses it to render the matching UI
   *  list. `includeNonParticipating` lives inside this filter. */
  filter?: ParamFilter
  /** Per-variant cap for `UnitList<number, V>` params.
   *  - `'UNIT_LIMIT'` caps at `UNIT_LIMITS[baseType]`.
   *  - `'IN_COMBAT'` caps at the count of all units of the same base type on
   *    the side (participating + non-participating, subtypes pooled with
   *    their base).
   *  - `'EXTRA'` caps at the remaining reinforcement headroom
   *    (`UNIT_LIMITS[baseType] - IN_COMBAT`, never below 0).
   *  Surfaces in the UI as `items[].max` and clamps stored values during
   *  reconcile. Ignored for non-`UnitList<number>` shapes.
   *
   *  Pair with `filter: { includeOnlyAvailable: true }` to also drop variants
   *  whose cap currently resolves to 0 from the UI and stored list. */
  limit?: ParamLimit
  /** With `scope: 'planet'`: divide the side's existing units between the
   *  invaded planets instead of choosing new ones per planet. */
  split?: UnitSplit
}

export interface DeclaredParamValue<T> extends Omit<
  SyncSourceConfig,
  'key' | 'source'
> {
  [DECLARED_PARAM]: true
  default: T
  source?: SyncSourceConfig['source']
}

/**
 * Mark a param as synced from one or more unit categories.
 * Returns `T` at the type level so `params` matches the `Params` generic.
 */
export function declareParam<T>(options: DeclaredParamOptions<T>): T {
  return {
    [DECLARED_PARAM]: true,
    default: options.default,
    source: options.source,
    scope: options.scope ?? 'participating',
    side: options.side ?? 'own',
    sort: options.sort ?? 'worth-asc',
    defaultItemValue: options.defaultItemValue,
    filter: options.filter,
    limit: options.limit,
    split: options.split,
  } as unknown as T
}

export function isDeclaredParam(
  value: unknown,
): value is DeclaredParamValue<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as DeclaredParamValue<unknown>)[DECLARED_PARAM] === true
  )
}

/**
 * Extract plain default values from an ability's `params`.
 * DeclaredParam values are unwrapped to their `.default`.
 * Results are cached per ability instance (ability objects are stable).
 */
const defaultsCache = new WeakMap<Ability, Record<string, unknown>>()

export function extractDefaults(ability: Ability): Record<string, unknown> {
  const cached = defaultsCache.get(ability)
  if (cached) return cached

  const raw = ability.params
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    result[key] = isDeclaredParam(value) ? value.default : value
  }

  defaultsCache.set(ability, result)
  return result
}

/**
 * Extract SyncSourceConfig[] from DeclaredParam entries with `.source`.
 */
export function extractSyncSources(
  ability: Ability,
): SyncSourceConfig[] | undefined {
  const raw = ability.params

  const result: SyncSourceConfig[] = []
  for (const [key, value] of Object.entries(raw)) {
    if (isDeclaredParam(value) && value.source) {
      result.push({
        key,
        source: value.source,
        scope: value.scope,
        side: value.side,
        sort: value.sort,
        defaultItemValue: value.defaultItemValue,
        filter: value.filter,
        limit: value.limit,
        split: value.split,
      })
    }
  }
  return result.length > 0 ? result : undefined
}
