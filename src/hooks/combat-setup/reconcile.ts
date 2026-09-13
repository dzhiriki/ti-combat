import {
  type AbilityLookupContext,
  applyVariantPostFilter,
  createRuntimeAbilityList,
  filterDeclaredSubtypes,
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
  SettingsParams,
  SyncSourceConfig,
} from '@/combat/abilities-engine/types'
import type {
  CombatMode,
  CombatStateData,
  SideAbilitiesConfig,
  SideStateData,
} from '@/combat/combat-state/types'
import { GROUND_FORCES, SHIPS } from '@/constants/units'
import type { CombatSide, UnitBaseType, UnitIdList } from '@/types'

import {
  expandWithSubtypes,
  reconcileStringParam,
  reconcileUnitListParam,
  sortBaseTypes,
} from './reconcile-helpers'

type AbilitiesConfig = Record<CombatSide, SideAbilitiesConfig>
type SideConfig = SideAbilitiesConfig

export type SideLookups = Record<
  CombatSide,
  OwnOpponentContext<RuntimeAbilityList>
>

/** Fallback for callers that hand over bare ability lists (tests): every
 *  slot lookup is empty, `all` is the side list. */
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

// UNIT_LIMIT only reads UNIT_LIMITS[base] and never touches unit state,
// so a fully-empty side is safe for the simulation-path caller that has
// no live state available.
const EMPTY_SIDE_FOR_STATIC: SideStateData = {
  faction: 'sol' as never,
  participatingUnits: '' as UnitIdList,
  nonParticipatingUnits: '' as UnitIdList,
  surfaceUnits: {},
  unitSurface: {},
  unitType: {},
  unitState: {},
  unitStats: {} as never,
  abilities: {},
  liveAbilities: {},
}

/** Tracks the last-seen valid list per sync-source param, so reconciliation
 *  can distinguish "user unchecked this" from "genuinely new item." */
export type SyncSnapshots = Map<string, string[]>

// ── Sync-source reconciliation helpers ────────────────────────────────────

function resolveSettings(
  abilities: RegisteredAbility[],
  config: SideConfig,
): { settings: SettingsParams; subtypes: DeclaredSubtype[] } {
  const settingsAbility = abilities.find(a => a.key === 'SETTINGS')
  const settings = {
    ...(settingsAbility ? extractDefaults(settingsAbility) : undefined),
    ...config['SETTINGS'],
  } as SettingsParams
  const subtypes = settings.subtypes ?? []
  return { settings, subtypes }
}

function buildValidList(
  config: SyncSourceConfig,
  ownSettings: SettingsParams,
  opponentSettings: SettingsParams,
  ownSubtypes: DeclaredSubtype[],
  opponentSubtypes: DeclaredSubtype[],
): string[] {
  const settings = config.side === 'own' ? ownSettings : opponentSettings
  const allSubtypes = config.side === 'own' ? ownSubtypes : opponentSubtypes
  const subtypes = config.filter?.includeOnlyBaseTypes
    ? []
    : filterDeclaredSubtypes(allSubtypes, config.filter)
  const group = settings[config.group] as UnitBaseType[]
  const sorted = sortBaseTypes(group, config.sort)
  const expanded = expandWithSubtypes(sorted, subtypes, config.sort)
  return applyVariantPostFilter(expanded, config.filter)
}

// ── Pure reconcile functions ────────────────────────────────────────────

/**
 * Materialize every ability's static defaults into the config so each base
 * entry carries a full default param set. Defaults are merged UNDER any
 * existing config, so user-supplied values always win — a partially
 * configured ability (e.g. just `{ uses: 1 }`) still gets the rest of its
 * defaults (`isEnabled`, etc.). Runtime code (resolveMergedParams,
 * decrementUses) then reads base/live only, never registered defaults.
 */
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

/**
 * Main reconcile entry point: resets base groups, ensures consumer defaults,
 * syncs all sources, and reconciles ability order.
 */
export function reconcileAbilitiesConfig(
  config: AbilitiesConfig,
  abilities: Record<CombatSide, RegisteredAbility[]>,
  combatMode: CombatMode,
  syncSnapshots?: SyncSnapshots,
  state?: Pick<CombatStateData, 'attacker' | 'defender'>,
  lookups?: SideLookups,
): void {
  const resolved = lookups ?? emptyLookups(abilities)
  resetBaseGroups(config, abilities, resolved)
  ensureConsumerDefaults(config, abilities)
  reconcileSyncAll(config, abilities, syncSnapshots, state)
  // Subtype declarations may depend on params that are themselves
  // sync-source params (e.g. PRE_GALVANIZED.galvanizedUnits is sourced from
  // `units`). The collectDeclaredSubtypes pass inside `resetBaseGroups`
  // saw those params before reconcile filled them in. Re-collect now and,
  // if the result changed, re-run sync so consumer params (Ghom Sek'kus,
  // Alarum, etc.) pick up the freshly-declared subtype variants.
  if (refreshDeclaredSubtypes(config, abilities, resolved)) {
    reconcileSyncAll(config, abilities, syncSnapshots, state)
  }
  reconcileAbilityOrder(config, abilities, combatMode, resolved)
}

/** Re-collect declared subtypes against the current (post-sync) consumer
 *  params. Returns true if any side's subtype list changed shape — caller
 *  re-runs sync to propagate. */
function refreshDeclaredSubtypes(
  config: AbilitiesConfig,
  abilities: Record<CombatSide, RegisteredAbility[]>,
  lookups: SideLookups,
): boolean {
  let changed = false
  for (const side of ['attacker', 'defender'] as const) {
    const settings = config[side]['SETTINGS'] as SettingsParams | undefined
    if (!settings) continue
    const next = collectDeclaredSubtypes(
      abilities[side],
      config[side],
      lookups[side],
    )
    if (subtypesEqual(settings.subtypes, next)) continue
    settings.subtypes = next
    changed = true
  }
  return changed
}

function subtypesEqual(a: DeclaredSubtype[], b: DeclaredSubtype[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    if (
      x.name !== y.name ||
      x.unitType !== y.unitType ||
      x.participating !== y.participating ||
      x.source !== y.source
    ) {
      return false
    }
  }
  return true
}

/**
 * Reset SETTINGS ships/groundForces/subtypes to base constants,
 * apply group additions from declareParamChange, and recompute
 * derived params via onParamSet.
 */
function resetBaseGroups(
  config: AbilitiesConfig,
  abilities: Record<CombatSide, RegisteredAbility[]>,
  lookups: SideLookups,
): void {
  for (const side of ['attacker', 'defender'] as const) {
    const sideAbilities = abilities[side]

    if (!config[side]['SETTINGS']) config[side]['SETTINGS'] = {}
    const settingsAbility = sideAbilities.find(a => a.key === 'SETTINGS')

    // Ensure all SETTINGS defaults are present (e.g. validTargetsSpaceCannonOffense)
    if (settingsAbility) {
      const defaults = extractDefaults(settingsAbility)
      for (const key of Object.keys(defaults)) {
        if (!(key in config[side]['SETTINGS']))
          config[side]['SETTINGS'][key] = defaults[key]
      }
    }

    const settings = config[side]['SETTINGS'] as SettingsParams
    settings.ships = [...SHIPS]
    settings.groundForces = [...GROUND_FORCES]
    settings.subtypes = []

    // Two passes: first builds groups (groundForces, etc.),
    // second resolves cross-group deps (e.g. Alastor copies groundForces → ships)
    for (let pass = 0; pass < 2; pass++) {
      const changes = collectParamChanges(
        sideAbilities,
        config[side],
        settings,
        lookups[side],
      )
      for (const change of changes) {
        const group = settings[change.key]
        if (!group.includes(change.value)) {
          group.push(change.value)
        }
      }
    }

    settings.subtypes = collectDeclaredSubtypes(
      sideAbilities,
      config[side],
      lookups[side],
    )

    // Compute SETTINGS derived params via onParamSet
    if (settingsAbility?.onParamSet) {
      const settingsCtx = hookContext(lookups[side], settingsAbility)
      settingsAbility.onParamSet(settings, 'ships', settings.ships, settingsCtx)
      settingsAbility.onParamSet(
        settings,
        'groundForces',
        settings.groundForces,
        settingsCtx,
      )
    }

    // onParamSet recomputes DERIVED groups (spaceCombatParticipating,
    // groundCombatParticipating, ...) from the base groups, clobbering
    // declared additions that target a derived group (e.g. Starlancer XI
    // adding MECH to spaceCombatParticipating). Re-apply the declared
    // changes on top — base-group additions are already present, so the
    // includes check makes them no-ops.
    const postDeriveChanges = collectParamChanges(
      sideAbilities,
      config[side],
      settings,
      lookups[side],
    )
    for (const change of postDeriveChanges) {
      const group = settings[change.key]
      if (!group.includes(change.value)) {
        group.push(change.value)
      }
    }
  }
}

/**
 * Ensure consumer abilities (those with sync-sources) have params
 * initialized from defaults. Also initializes SETTINGS defaults.
 */
function ensureConsumerDefaults(
  config: AbilitiesConfig,
  abilities: Record<CombatSide, RegisteredAbility[]>,
): void {
  for (const side of ['attacker', 'defender'] as const) {
    for (const ability of abilities[side]) {
      if (!extractSyncSources(ability)) continue
      const defaults = extractDefaults(ability)
      if (defaults) {
        config[side][ability.key] = {
          ...defaults,
          ...config[side][ability.key],
        }
      }
    }
  }
}

/**
 * Shared sync logic: reconcile SETTINGS computed params for both sides,
 * then reconcile consumer params with cross-side access.
 */
function reconcileSyncAll(
  config: AbilitiesConfig,
  abilities: Record<CombatSide, RegisteredAbility[]>,
  syncSnapshots?: SyncSnapshots,
  state?: Pick<CombatStateData, 'attacker' | 'defender'>,
): void {
  // Pass 1: Reconcile SETTINGS computed params for both sides
  // Must happen before consumers so cross-side sources
  // (e.g. Raid Formation reading opponent's nonFighterShips) see
  // computed values.
  for (const side of ['attacker', 'defender'] as const) {
    const sideAbilities = abilities[side]
    const { settings, subtypes } = resolveSettings(sideAbilities, config[side])
    reconcileSyncSources(
      sideAbilities.filter(a => a.key === 'SETTINGS'),
      config[side],
      settings,
      settings,
      subtypes,
      subtypes,
      side,
      syncSnapshots,
      state,
    )
  }

  // Pass 2: Reconcile consumer abilities with fresh cross-side settings
  for (const side of ['attacker', 'defender'] as const) {
    const oppSide = side === 'attacker' ? 'defender' : 'attacker'
    const sideAbilities = abilities[side]
    const { settings: ownSettings, subtypes: ownSubtypes } = resolveSettings(
      sideAbilities,
      config[side],
    )
    const { settings: oppSettings, subtypes: oppSubtypes } = resolveSettings(
      abilities[oppSide],
      config[oppSide],
    )
    reconcileSyncSources(
      sideAbilities.filter(a => a.key !== 'SETTINGS'),
      config[side],
      ownSettings,
      oppSettings,
      ownSubtypes,
      oppSubtypes,
      side,
      syncSnapshots,
      state,
    )
  }
}

/**
 * Reconcile ABILITY_ORDER params: keep only keys for abilities that are
 * enabled and have matching invokes, preserving user-chosen order.
 */
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
        ).some(inv => timingSet.has(inv.timing))
        if (hasMatchingInvoke) {
          validKeys.push(ability.key)
        }
      }

      const currentOrder =
        (orderConfig[group.paramKey] as [string][] | undefined) ?? []
      const validSet = new Set(validKeys)
      const kept = currentOrder.filter(([key]) => validSet.has(key))
      const keptKeys = new Set(kept.map(([key]) => key))
      const added: [string][] = validKeys
        .filter(key => !keptKeys.has(key))
        .map(key => [key])
      // Newly enabled abilities lead — they're presumed to take precedence
      // over the previously-ordered defaults.
      orderConfig[group.paramKey] = [...added, ...kept]
    }
  }
}

function collectParamChanges(
  abilities: readonly RegisteredAbility[],
  params: Record<string, Record<string, unknown>>,
  settings: SettingsParams,
  lookups: OwnOpponentContext<RuntimeAbilityList>,
): ParamChange[] {
  const result: ParamChange[] = []

  for (const ability of abilities) {
    if (!ability.declareParamChange) continue

    const abilityParams = {
      ...extractDefaults(ability),
      ...params[ability.key],
    }

    if (ability.headerUI) {
      const headerValue = abilityParams[ability.headerUI]
      if (!headerValue) continue
    }

    const declared = ability.declareParamChange(
      abilityParams,
      settings,
      hookContext(lookups, ability),
    )
    for (const change of declared) {
      result.push(change)
    }
  }

  return result
}

function collectDeclaredSubtypes(
  abilities: readonly RegisteredAbility[],
  params: Record<string, Record<string, unknown>>,
  lookups: OwnOpponentContext<RuntimeAbilityList>,
): DeclaredSubtype[] {
  const result: DeclaredSubtype[] = []

  for (const ability of abilities) {
    if (!ability.declareSubtype) continue

    const abilityParams = {
      ...extractDefaults(ability),
      ...params[ability.key],
    }

    if (ability.headerUI) {
      const headerValue = abilityParams[ability.headerUI]
      if (!headerValue) continue
    }

    const declared = ability.declareSubtype(
      abilityParams as AbilityBaseParams & Record<string, unknown>,
      hookContext(lookups, ability),
    )
    for (const decl of declared) {
      const stamped = { ...decl, source: ability.key }
      if (
        !result.some(
          d =>
            d.source === stamped.source &&
            d.name === stamped.name &&
            d.unitType === stamped.unitType,
        )
      ) {
        result.push(stamped)
      }
    }
  }

  return result
}

function reconcileSyncSources(
  abilities: readonly RegisteredAbility[],
  params: Record<string, Record<string, unknown>>,
  ownSettings: SettingsParams,
  opponentSettings: SettingsParams,
  ownSubtypes: DeclaredSubtype[],
  opponentSubtypes: DeclaredSubtype[],
  side: CombatSide,
  syncSnapshots?: SyncSnapshots,
  state?: Pick<CombatStateData, 'attacker' | 'defender'>,
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

    for (const config of syncSources) {
      if (config.compute) {
        const settings = config.side === 'own' ? ownSettings : opponentSettings
        abilityParams[config.key] = config.compute(settings[config.group])
        continue
      }

      let validList = buildValidList(
        config,
        ownSettings,
        opponentSettings,
        ownSubtypes,
        opponentSubtypes,
      )

      const currentValue = abilityParams[config.key]

      if (Array.isArray(currentValue)) {
        const targetSide =
          config.side === 'own'
            ? side
            : side === 'attacker'
              ? 'defender'
              : 'attacker'
        const sideData: SideStateData | undefined = state?.[targetSide]
        const limit = config.limit
        // UNIT_LIMIT doesn't read state, so the static fallback covers the
        // simulation path that calls reconcile without a state. IN_COMBAT
        // silently no-ops without state — values arriving from the UI hook
        // are already clamped before serialization.
        const maxFor = limit
          ? sideData
            ? (variantKey: string) =>
                resolveVariantLimit(limit, sideData, variantKey as never)
            : limit === 'UNIT_LIMIT'
              ? (variantKey: string) =>
                  resolveVariantLimit(
                    limit,
                    EMPTY_SIDE_FOR_STATIC,
                    variantKey as never,
                  )
              : undefined
          : undefined
        if (config.filter?.includeOnlyAvailable && maxFor) {
          validList = validList.filter(k => maxFor(k) > 0)
        }
        abilityParams[config.key] = reconcileUnitListParam(
          currentValue as ([string] | [string, unknown])[],
          validList,
          config.defaultItemValue,
          maxFor,
        )
        if (syncSnapshots) {
          const snapshotKey = `${side}:${ability.key}:${config.key}`
          syncSnapshots.set(snapshotKey, validList)
        }
      } else if (typeof currentValue === 'string') {
        abilityParams[config.key] = reconcileStringParam(
          currentValue,
          validList,
        )
      }
    }
  }
}

// ── fromConfig helpers ───────────────────────────────────────────────────

/**
 * Snapshot consumer params (everything except SETTINGS) so they can
 * be restored after reconcile overwrites them.
 */
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
      if (ability.key === 'SETTINGS') continue
      const params = config[side][ability.key]
      if (params) {
        saved[side][ability.key] = { ...params }
      }
    }
  }
  return saved
}

/**
 * Restore consumer params that reconcile overwrote.
 */
export function restoreConsumerParams(
  config: AbilitiesConfig,
  abilities: Record<CombatSide, RegisteredAbility[]>,
  saved: Record<CombatSide, Record<string, Record<string, unknown>>>,
): void {
  for (const side of ['attacker', 'defender'] as const) {
    for (const ability of abilities[side]) {
      if (ability.key === 'SETTINGS') continue
      const userParams = saved[side][ability.key]
      if (!userParams) continue
      const synced = config[side][ability.key]
      if (!synced) continue
      Object.assign(synced, userParams)
    }
  }
}

/**
 * Clamp numeric `UnitList<number>` entries in-place for any declared param
 * with `limit`. Called after `restoreConsumerParams` to enforce caps without
 * re-expanding the valid list (which would otherwise add missing entries
 * and break order-mode params / user-trimmed lists).
 *
 * Without `state`, only `UNIT_LIMIT` is enforced (the cap is state-independent).
 * With `state`, `IN_COMBAT` and `EXTRA` are clamped as well — used by
 * `buildCombatState` after the per-side state is constructed, so test setups
 * that bypass the UI hook still get the same clamp.
 */
export function clampLimitParams(
  config: AbilitiesConfig,
  abilities: Record<CombatSide, RegisteredAbility[]>,
  state?: Pick<CombatStateData, 'attacker' | 'defender'>,
): void {
  for (const side of ['attacker', 'defender'] as const) {
    for (const ability of abilities[side]) {
      const syncSources = extractSyncSources(ability)
      if (!syncSources) continue
      const abilityParams = config[side][ability.key]
      if (!abilityParams) continue

      for (const src of syncSources) {
        if (!src.limit) continue
        const value = abilityParams[src.key]
        if (!Array.isArray(value)) continue

        const targetSide =
          src.side === 'own'
            ? side
            : side === 'attacker'
              ? 'defender'
              : 'attacker'
        const sideData = state?.[targetSide]
        // IN_COMBAT / EXTRA need real state. Without it, skip — the UI hook
        // is responsible for clamping those before they reach this path.
        if (src.limit !== 'UNIT_LIMIT' && !sideData) continue
        const resolverSide = sideData ?? EMPTY_SIDE_FOR_STATIC

        let changed = false
        const dropOnZero = src.filter?.includeOnlyAvailable === true
        const entries = value as ([string] | [string, unknown])[]
        const clamped: ([string] | [string, unknown])[] = []
        for (const entry of entries) {
          const max = resolveVariantLimit(
            src.limit!,
            resolverSide,
            entry[0] as never,
          )
          if (dropOnZero && Number.isFinite(max) && max <= 0) {
            changed = true
            continue
          }
          if (entry.length !== 2 || typeof entry[1] !== 'number') {
            clamped.push(entry)
            continue
          }
          if (Number.isFinite(max) && (entry[1] as number) > max) {
            changed = true
            clamped.push([entry[0], max] as [string, number])
          } else {
            clamped.push(entry)
          }
        }

        if (changed) {
          if (Object.isFrozen(abilityParams)) {
            const unfrozen = { ...abilityParams }
            config[side][ability.key] = unfrozen
            unfrozen[src.key] = clamped
          } else {
            abilityParams[src.key] = clamped
          }
        }
      }
    }
  }
}

// ── Simulation-path helpers ─────────────────────────────────────────────

/**
 * Reset SETTINGS to base groups (no group additions) and recompute
 * derived params. Subtypes from declareParamChange are preserved.
 * Does not touch consumer params.
 */
export function resetSettingsToBase(
  config: AbilitiesConfig,
  abilities: Record<CombatSide, RegisteredAbility[]>,
  lookups?: SideLookups,
): void {
  const resolved = lookups ?? emptyLookups(abilities)
  for (const side of ['attacker', 'defender'] as const) {
    const sideAbilities = abilities[side]
    const settings = config[side]['SETTINGS'] as SettingsParams | undefined
    if (!settings) continue

    settings.ships = [...SHIPS]
    settings.groundForces = [...GROUND_FORCES]
    settings.subtypes = collectDeclaredSubtypes(
      sideAbilities,
      config[side],
      resolved[side],
    )

    // Compute SETTINGS derived params via onParamSet
    const settingsAbility = sideAbilities.find(a => a.key === 'SETTINGS')
    if (settingsAbility?.onParamSet) {
      const settingsCtx = hookContext(resolved[side], settingsAbility)
      settingsAbility.onParamSet(settings, 'ships', settings.ships, settingsCtx)
      settingsAbility.onParamSet(
        settings,
        'groundForces',
        settings.groundForces,
        settingsCtx,
      )
    }
  }
}
