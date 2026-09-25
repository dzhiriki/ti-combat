import {
  type AbilityLookupContext,
  createRuntimeAbilityList,
  getOpponentSide,
  type OwnOpponentContext,
  resolveInvokes,
  type RuntimeAbilityList,
} from '@/combat'
import { TIMING_GROUPS } from '@/combat/abilities-engine/abilities-engine'
import {
  extractDefaults,
  extractSyncSources,
} from '@/combat/abilities-engine/declare-param'
import { resolveVariantLimit } from '@/combat/abilities-engine/param-limit'
import type {
  Ability,
  AbilityBaseParams,
  DeclaredSubtype,
  ParamChange,
  RegisteredAbility,
  SyncSourceConfig,
  UnitCategoryOptions,
} from '@/combat/abilities-engine/types'
import {
  resolveUnitOptions,
  expandLegacyUnitTargets,
} from '@/combat/abilities-engine/unit-options'
import type {
  CombatMode,
  CombatStateData,
  SideAbilitiesConfig,
  SideStateData,
  UnitStatsEntry,
} from '@/combat/combat-state/types'
import { parseUnitLocator } from '@/combat/utils/parse-unit-locator'
import {
  UNIT_CATEGORIES,
  UNIT_TYPES,
  type UnitCategory,
} from '@/constants/units'
import type { CombatSide, UnitBaseType, UnitIdList, UnitStats } from '@/types'

import {
  reconcileStringParam,
  reconcileUnitListParam,
} from './reconcile-helpers'

type OptionState = Pick<CombatStateData, 'attacker' | 'defender'> &
  Partial<Pick<CombatStateData, 'surfaces' | 'activeSurfaceId' | 'combatMode'>>

type AbilitiesConfig = Record<CombatSide, SideAbilitiesConfig>

export type SideLookups = Record<
  CombatSide,
  OwnOpponentContext<RuntimeAbilityList>
>

export interface SideOptionMetadata {
  categories: UnitCategoryOptions
  changes: ParamChange[]
  subtypes: DeclaredSubtype[]
}

export type OptionMetadata = Record<CombatSide, SideOptionMetadata>

function emptyLookups(
  abilities: Record<CombatSide, RegisteredAbility[]>,
): SideLookups {
  const attacker = createRuntimeAbilityList(abilities.attacker)
  const defender = createRuntimeAbilityList(abilities.defender)
  return {
    attacker: { own: attacker, opponent: defender },
    defender: { own: defender, opponent: attacker },
  }
}

function hookContext(
  lookups: OwnOpponentContext<RuntimeAbilityList>,
  ability: Ability,
): AbilityLookupContext {
  return { abilities: lookups, this: ability }
}

const EMPTY_SIDE_FOR_STATIC: SideStateData = {
  faction: 'sol' as never,
  participatingUnits: '' as UnitIdList,
  nonParticipatingUnits: '' as UnitIdList,

  unitSurface: {},
  unitType: {},
  unitState: {},
  unitStats: {} as never,
  abilities: {},
  liveAbilities: {},
}

function categoryList(
  metadata: SideOptionMetadata,
  source: UnitCategory | readonly UnitCategory[],
): UnitBaseType[] {
  const categories: readonly UnitCategory[] = Array.isArray(source)
    ? source
    : [source]
  const result: UnitBaseType[] = []
  for (const category of categories) {
    for (const type of metadata.categories[category]) {
      if (!result.includes(type)) result.push(type)
    }
  }
  return result
}

export function initializeAbilityDefaults(
  config: AbilitiesConfig,
  abilities: Record<CombatSide, RegisteredAbility[]>,
): void {
  for (const side of ['attacker', 'defender'] as const) {
    for (const ability of abilities[side]) {
      const defaults = extractDefaults(ability)
      config[side][ability.key] = { ...defaults, ...config[side][ability.key] }
    }
  }
}

export function reconcileAbilitiesConfig(
  config: AbilitiesConfig,
  abilities: Record<CombatSide, RegisteredAbility[]>,
  combatMode: CombatMode,
  state?: OptionState,
  lookups?: SideLookups,
  unitStats?: Record<CombatSide, Record<string, UnitStatsEntry>>,
  scopedDefaults = false,
): OptionMetadata {
  const resolved = lookups ?? emptyLookups(abilities)
  ensureConsumerDefaults(config, abilities)

  let metadata = collectOptionMetadata(
    config,
    abilities,
    resolved,
    state,
    unitStats,
  )
  reconcileSyncAll(
    config,
    abilities,
    metadata,
    state,
    combatMode,
    scopedDefaults,
  )

  const refreshed = collectOptionMetadata(
    config,
    abilities,
    resolved,
    state,
    unitStats,
  )
  if (!metadataEqual(metadata, refreshed)) {
    metadata = refreshed
    reconcileSyncAll(
      config,
      abilities,
      metadata,
      state,
      combatMode,
      scopedDefaults,
    )
  }

  applyMetadataToState(state, metadata)
  reconcileAbilityOrder(config, abilities, combatMode, resolved)
  return metadata
}

function applyMetadataToState(
  state: OptionState | undefined,
  metadata: OptionMetadata,
): void {
  if (!state) return
  for (const side of ['attacker', 'defender'] as const) {
    state[side].unitCategoryOptions = metadata[side].categories
    state[side].unitCategoryChanges = metadata[side].changes
    state[side].declaredSubtypes = metadata[side].subtypes
  }
}

function metadataEqual(a: OptionMetadata, b: OptionMetadata): boolean {
  for (const side of ['attacker', 'defender'] as const) {
    for (const category of Object.keys(UNIT_CATEGORIES) as UnitCategory[]) {
      if (
        a[side].categories[category].join() !==
        b[side].categories[category].join()
      )
        return false
    }
    if (JSON.stringify(a[side].changes) !== JSON.stringify(b[side].changes))
      return false
    if (!subtypesEqual(a[side].subtypes, b[side].subtypes)) return false
  }
  return true
}

function subtypesEqual(a: DeclaredSubtype[], b: DeclaredSubtype[]): boolean {
  if (a.length !== b.length) return false
  return a.every((value, index) => {
    const other = b[index]
    return (
      value.name === other.name &&
      value.unitType === other.unitType &&
      value.participating === other.participating &&
      value.source === other.source &&
      JSON.stringify(value.surfaces) === JSON.stringify(other.surfaces)
    )
  })
}

function nativeCategories(
  stats: Record<string, UnitStatsEntry> | undefined,
): UnitCategoryOptions {
  const result: UnitCategoryOptions = {
    SHIPS: [],
    GROUND_FORCES: [],
    STRUCTURES: [],
  }

  for (const type of UNIT_TYPES) {
    const entry = stats?.[type]
    const explicit =
      entry && typeof entry !== 'function' ? entry.CATEGORIES : undefined
    for (const category of Object.keys(UNIT_CATEGORIES) as UnitCategory[]) {
      if (
        explicit?.includes(category) ||
        (!explicit &&
          (UNIT_CATEGORIES[category] as readonly UnitBaseType[]).includes(type))
      ) {
        result[category].push(type)
      }
    }
  }
  return result
}

function applyEnabledStatsCategories(
  categories: UnitCategoryOptions,
  abilities: readonly RegisteredAbility[],
  params: SideAbilitiesConfig,
): void {
  for (const ability of abilities) {
    const merged = { ...extractDefaults(ability), ...params[ability.key] }
    if (ability.headerUI && !merged[ability.headerUI]) continue
    if (merged.isEnabled === false || !Array.isArray(ability.invoke)) continue

    for (const invoke of ability.invoke) {
      const statsInvoke = invoke as typeof invoke & {
        kind?: string
        unitType?: UnitBaseType
        stats?: Readonly<UnitStats>
      }
      if (
        statsInvoke.kind !== 'stats' ||
        !statsInvoke.unitType ||
        !statsInvoke.stats?.CATEGORIES
      )
        continue
      for (const category of Object.keys(UNIT_CATEGORIES) as UnitCategory[]) {
        const group = categories[category]
        const index = group.indexOf(statsInvoke.unitType)
        const included = statsInvoke.stats.CATEGORIES.includes(category)
        if (included && index < 0) group.push(statsInvoke.unitType)
        else if (!included && index >= 0) group.splice(index, 1)
      }
    }
  }
}

function collectOptionMetadata(
  config: AbilitiesConfig,
  abilities: Record<CombatSide, RegisteredAbility[]>,
  lookups: SideLookups,
  state?: OptionState,
  stats?: Record<CombatSide, Record<string, UnitStatsEntry>>,
): OptionMetadata {
  return Object.fromEntries(
    (['attacker', 'defender'] as const).map(side => {
      const categories = nativeCategories(
        stats?.[side] ?? state?.[side].unitStats,
      )
      applyEnabledStatsCategories(categories, abilities[side], config[side])
      const changes = collectParamChanges(
        abilities[side],
        config[side],
        lookups[side],
      )

      for (let pass = 0; pass < 2; pass++) {
        for (const change of changes) {
          const additions =
            change.value in UNIT_CATEGORIES
              ? categories[change.value as UnitCategory]
              : [change.value as UnitBaseType]
          for (const type of additions) {
            if (!categories[change.key].includes(type))
              categories[change.key].push(type)
          }
        }
      }

      return [
        side,
        {
          categories,
          changes,
          subtypes: collectDeclaredSubtypes(
            abilities[side],
            config[side],
            lookups[side],
          ),
        },
      ]
    }),
  ) as OptionMetadata
}

function ensureConsumerDefaults(
  config: AbilitiesConfig,
  abilities: Record<CombatSide, RegisteredAbility[]>,
): void {
  for (const side of ['attacker', 'defender'] as const) {
    for (const ability of abilities[side]) {
      if (!extractSyncSources(ability)) continue
      const defaults = extractDefaults(ability)
      config[side][ability.key] = {
        ...defaults,
        ...config[side][ability.key],
      }
    }
  }
}

function reconcileSyncAll(
  config: AbilitiesConfig,
  abilities: Record<CombatSide, RegisteredAbility[]>,
  metadata: OptionMetadata,
  state?: OptionState,
  combatMode: CombatMode = 'SPACE',
  scopedDefaults = false,
): void {
  for (const side of ['attacker', 'defender'] as const) {
    const opponent = side === 'attacker' ? 'defender' : 'attacker'
    reconcileSyncSources(
      abilities[side],
      config[side],
      metadata[side],
      metadata[opponent],
      side,
      state,
      combatMode,
      scopedDefaults,
    )
  }
}

function reconcileAbilityOrder(
  config: AbilitiesConfig,
  abilities: Record<CombatSide, RegisteredAbility[]>,
  combatMode: CombatMode,
  lookups: SideLookups,
): void {
  for (const side of ['attacker', 'defender'] as const) {
    const sideAbilities = abilities[side]
    const sideConfig = config[side]

    if (!sideConfig['ABILITY_ORDER']) {
      sideConfig['ABILITY_ORDER'] = { isEnabled: true, uses: Infinity }
    } else if (Object.isFrozen(sideConfig['ABILITY_ORDER'])) {
      sideConfig['ABILITY_ORDER'] = { ...sideConfig['ABILITY_ORDER'] }
    }
    const orderConfig = sideConfig['ABILITY_ORDER']

    for (const group of TIMING_GROUPS) {
      const timingSet = new Set(group.timings)
      const validKeys: string[] = []

      for (const ability of sideAbilities) {
        if (ability.key === 'ABILITY_ORDER') continue
        if (ability.context && ability.context !== combatMode) continue
        const abilityConfig = sideConfig[ability.key] ?? ability.params
        if ('isEnabled' in abilityConfig && !abilityConfig.isEnabled) continue
        if (
          'uses' in abilityConfig &&
          typeof abilityConfig.uses === 'number' &&
          isFinite(abilityConfig.uses) &&
          abilityConfig.uses <= 0
        )
          continue
        const hasMatchingInvoke = resolveInvokes(
          ability,
          abilityConfig,
          hookContext(lookups[side], ability),
        ).some(invoke => timingSet.has(invoke.timing))
        if (hasMatchingInvoke) validKeys.push(ability.key)
      }

      const currentOrder =
        (orderConfig[group.paramKey] as [string][] | undefined) ?? []
      const validSet = new Set(validKeys)
      const kept = currentOrder.filter(([key]) => validSet.has(key))
      const keptKeys = new Set(kept.map(([key]) => key))
      const added: [string][] = validKeys
        .filter(key => !keptKeys.has(key))
        .map(key => [key])
      orderConfig[group.paramKey] = [...added, ...kept]
    }
  }
}

function collectParamChanges(
  abilities: readonly RegisteredAbility[],
  params: SideAbilitiesConfig,
  lookups: OwnOpponentContext<RuntimeAbilityList>,
): ParamChange[] {
  const result: ParamChange[] = []
  for (const ability of abilities) {
    if (!ability.declareParamChange) continue
    const abilityParams = {
      ...extractDefaults(ability),
      ...params[ability.key],
    }
    if (ability.headerUI && !abilityParams[ability.headerUI]) continue
    result.push(
      ...ability.declareParamChange(
        abilityParams,
        hookContext(lookups, ability),
      ),
    )
  }
  return result
}

export function collectDeclaredSubtypes(
  abilities: readonly RegisteredAbility[],
  params: SideAbilitiesConfig,
  lookups: OwnOpponentContext<RuntimeAbilityList>,
): DeclaredSubtype[] {
  const result: DeclaredSubtype[] = []
  for (const ability of abilities) {
    if (!ability.declareSubtype) continue
    const abilityParams = {
      ...extractDefaults(ability),
      ...params[ability.key],
    }
    if (ability.headerUI && !abilityParams[ability.headerUI]) continue
    const declared = ability.declareSubtype(
      abilityParams as AbilityBaseParams & Record<string, unknown>,
      hookContext(lookups, ability),
    )
    for (const declaration of declared) {
      const stamped = { ...declaration, source: ability.key }
      if (
        !result.some(
          existing =>
            existing.source === stamped.source &&
            existing.name === stamped.name &&
            existing.unitType === stamped.unitType &&
            JSON.stringify(existing.surfaces) ===
              JSON.stringify(stamped.surfaces),
        )
      )
        result.push(stamped)
    }
  }
  return result
}

function sourceSide(side: CombatSide, source: SyncSourceConfig): CombatSide {
  return source.side === 'own' ? side : getOpponentSide(side)
}

/** Keep a single choice's unit type when its surface is no longer offered. */
function relocateUnitTarget(value: string, validList: string[]): string {
  if (!value.startsWith('@') || validList.includes(value)) return value
  const { unitType } = parseUnitLocator(value)
  return (
    validList.find(option => parseUnitLocator(option).unitType === unitType) ??
    value
  )
}

function reconcileSyncSources(
  abilities: readonly RegisteredAbility[],
  params: SideAbilitiesConfig,
  own: SideOptionMetadata,
  opponent: SideOptionMetadata,
  side: CombatSide,
  state?: OptionState,
  combatMode: CombatMode = 'SPACE',
  scopedDefaults = false,
): void {
  for (const ability of abilities) {
    const syncSources = extractSyncSources(ability)
    if (!syncSources) continue
    let abilityParams = params[ability.key]
    if (!abilityParams) continue
    if (Object.isFrozen(abilityParams)) {
      abilityParams = { ...abilityParams }
      params[ability.key] = abilityParams
    }

    for (const source of syncSources) {
      const sourceMetadata = source.side === 'own' ? own : opponent
      const sourceTypes = categoryList(sourceMetadata, source.source)
      if (source.compute) {
        abilityParams[source.key] = source.compute(sourceTypes)
        continue
      }

      const currentValue = abilityParams[source.key]
      const surfaceScoped =
        source.scope !== 'type' &&
        (scopedDefaults ||
          (typeof currentValue === 'string'
            ? currentValue.startsWith('@')
            : Array.isArray(currentValue) &&
              currentValue.some(entry =>
                (typeof entry === 'string' ? entry : entry[0]).startsWith('@'),
              )))
      // Simulation preparation can run before placements exist. Qualified
      // user selections must survive until that context is available.
      if (surfaceScoped && !state?.surfaces) {
        const keys = Array.isArray(currentValue)
          ? currentValue.map(entry =>
              typeof entry === 'string' ? entry : entry[0],
            )
          : [currentValue]
        if (keys.some(key => typeof key === 'string' && key.startsWith('@')))
          continue
      }
      const targetSide = sourceSide(side, source)
      const sideData = state?.[targetSide]
      const optionState = {
        ...(sideData ?? EMPTY_SIDE_FOR_STATIC),
        unitCategoryOptions: sourceMetadata.categories,
        unitCategoryChanges: sourceMetadata.changes,
        declaredSubtypes: sourceMetadata.subtypes,
      }
      const options = resolveUnitOptions(
        optionState,
        {
          combatMode,
          activeSurfaceId: state?.activeSurfaceId,
          surfaces: state?.surfaces,
          side: targetSide,
          // Lists keep per-surface choices for every planet; a single choice
          // follows the active surface unless its mode is not being fought.
          allSurfaces:
            Array.isArray(currentValue) ||
            (source.filter?.combatMode ?? combatMode) !== combatMode,
        },
        {
          ...source,
          scope: surfaceScoped ? source.scope : 'type',
          limit:
            sideData || source.limit === 'UNIT_LIMIT'
              ? source.limit
              : undefined,
        },
      )
      const validList = options.map(option => option.value)
      const maxima = new Map(options.map(option => [option.value, option.max]))
      const maxFor = source.limit
        ? (key: string) => maxima.get(key as never) ?? Infinity
        : undefined
      if (Array.isArray(currentValue)) {
        const expanded =
          surfaceScoped && sideData
            ? expandLegacyUnitTargets(currentValue, options, sideData)
            : currentValue
        abilityParams[source.key] = reconcileUnitListParam(
          expanded as ([string] | [string, unknown])[],
          validList,
          source.defaultItemValue,
          maxFor,
        )
      } else if (typeof currentValue === 'string') {
        const expanded =
          surfaceScoped && sideData
            ? ((expandLegacyUnitTargets(
                [currentValue],
                options,
                sideData,
              )[0] as string | undefined) ?? currentValue)
            : currentValue
        abilityParams[source.key] = reconcileStringParam(
          relocateUnitTarget(expanded, validList),
          validList,
        )
      }
    }
  }
}

export function snapshotConsumerParams(
  config: AbilitiesConfig,
  abilities: Record<CombatSide, RegisteredAbility[]>,
): Record<CombatSide, Record<string, Record<string, unknown>>> {
  const saved: Record<CombatSide, Record<string, Record<string, unknown>>> = {
    attacker: {},
    defender: {},
  }
  for (const side of ['attacker', 'defender'] as const) {
    for (const ability of abilities[side]) {
      const params = config[side][ability.key]
      if (params) saved[side][ability.key] = { ...params }
    }
  }
  return saved
}

export function restoreConsumerParams(
  config: AbilitiesConfig,
  abilities: Record<CombatSide, RegisteredAbility[]>,
  saved: Record<CombatSide, Record<string, Record<string, unknown>>>,
): void {
  for (const side of ['attacker', 'defender'] as const) {
    for (const ability of abilities[side]) {
      const userParams = saved[side][ability.key]
      const synced = config[side][ability.key]
      if (userParams && synced) Object.assign(synced, userParams)
    }
  }
}

export function clampLimitParams(
  config: AbilitiesConfig,
  abilities: Record<CombatSide, RegisteredAbility[]>,
  state?: OptionState,
): void {
  for (const side of ['attacker', 'defender'] as const) {
    for (const ability of abilities[side]) {
      const syncSources = extractSyncSources(ability)
      if (!syncSources) continue
      const abilityParams = config[side][ability.key]
      if (!abilityParams) continue

      for (const source of syncSources) {
        if (!source.limit) continue
        const value = abilityParams[source.key]
        if (!Array.isArray(value)) continue
        const targetSide = sourceSide(side, source)
        const sideData = state?.[targetSide]
        if (source.limit !== 'UNIT_LIMIT' && !sideData) continue
        const resolverSide = sideData ?? EMPTY_SIDE_FOR_STATIC
        // Clamp against the caps the controls offered, including projected
        // commitments; keys outside that catalog keep the physical cap.
        const maxima = new Map(
          (sideData && state?.surfaces
            ? resolveUnitOptions(
                sideData,
                {
                  combatMode: state.combatMode ?? 'SPACE',
                  activeSurfaceId: state.activeSurfaceId,
                  surfaces: state.surfaces,
                  side: targetSide,
                  allSurfaces: true,
                },
                {
                  ...source,
                  filter: { ...source.filter, includeOnlyAvailable: false },
                },
              )
            : []
          ).map(option => [option.value as string, option.max]),
        )

        let changed = false
        const clamped: ([string] | [string, unknown])[] = []
        for (const entry of value as ([string] | [string, unknown])[]) {
          const max =
            maxima.get(entry[0]) ??
            resolveVariantLimit(source.limit, resolverSide, entry[0] as never)
          if (
            source.filter?.includeOnlyAvailable &&
            Number.isFinite(max) &&
            max <= 0
          ) {
            changed = true
            continue
          }
          if (
            entry.length === 2 &&
            typeof entry[1] === 'number' &&
            Number.isFinite(max) &&
            entry[1] > max
          ) {
            changed = true
            clamped.push([entry[0], max])
          } else {
            clamped.push(entry)
          }
        }

        if (!changed) continue
        if (Object.isFrozen(abilityParams)) {
          config[side][ability.key] = {
            ...abilityParams,
            [source.key]: clamped,
          }
        } else {
          abilityParams[source.key] = clamped
        }
      }
    }
  }
}
