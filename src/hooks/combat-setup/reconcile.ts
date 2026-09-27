import {
  type AbilityLookupContext,
  createLookups,
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
  RegisteredAbility,
  SideOptionMetadata,
  SyncSourceConfig,
} from '@/combat/abilities-engine/types'
import { resolveUnitOptions } from '@/combat/abilities-engine/unit-options'
import type {
  CombatMode,
  CombatStateData,
  SideAbilitiesConfig,
  SideStateData,
} from '@/combat/combat-state/types'
import { parseUnitLocator } from '@/combat/utils/parse-unit-locator'
import {
  type CombatSide,
  createDefaultSurfaces,
  SPACE_SURFACE_ID,
  type SurfaceId,
} from '@/types'

import { applyDeclaredChanges } from './apply-declared-changes'
import {
  reconcileStringParam,
  reconcileUnitListParam,
} from './reconcile-helpers'

type OptionState = Pick<CombatStateData, 'attacker' | 'defender'> &
  Partial<
    Pick<CombatStateData, 'surfaces' | 'activeSurfaceId' | 'combatMode'>
  > & {
    /** Set by the simplified editor: options cover only what it can put. */
    simplifiedPlanetId?: SurfaceId
  }

type AbilitiesConfig = Record<CombatSide, SideAbilitiesConfig>

export type SideLookups = Record<
  CombatSide,
  OwnOpponentContext<RuntimeAbilityList>
>

export type OptionMetadata = Record<CombatSide, SideOptionMetadata>

function hookContext(
  lookups: OwnOpponentContext<RuntimeAbilityList>,
  ability: Ability,
): AbilityLookupContext {
  return { abilities: lookups, this: ability }
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
  state: OptionState,
  lookups: SideLookups = createLookups(abilities),
  scopedDefaults = false,
): OptionMetadata {
  ensureConsumerDefaults(config, abilities)

  // Changes read no synced params, so they apply once, before syncing.
  const input = (side: CombatSide) => ({
    faction: state[side].faction,
    unitStats: state[side].unitStats,
    config: config[side],
    abilities: abilities[side],
  })
  const standIns = applyDeclaredChanges(
    { attacker: input('attacker'), defender: input('defender') },
    state.surfaces ?? createDefaultSurfaces(),
    combatMode,
    state.activeSurfaceId ?? SPACE_SURFACE_ID,
    state.simplifiedPlanetId,
  )
  let metadata = collectOptionMetadata(config, abilities, lookups, standIns)
  reconcileSyncAll(
    config,
    abilities,
    metadata,
    state,
    combatMode,
    scopedDefaults,
  )

  const refreshed = collectOptionMetadata(config, abilities, lookups, standIns)
  // JSON skips the subtypes' stats factories, which never differ here.
  if (
    JSON.stringify(subtypes(metadata)) !== JSON.stringify(subtypes(refreshed))
  ) {
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

  for (const side of ['attacker', 'defender'] as const) {
    state[side].optionMetadata = metadata[side]
  }
  reconcileAbilityOrder(config, abilities, combatMode, lookups)
  return metadata
}

function collectOptionMetadata(
  config: AbilitiesConfig,
  abilities: Record<CombatSide, RegisteredAbility[]>,
  lookups: SideLookups,
  standIns: Record<CombatSide, SideStateData>,
): OptionMetadata {
  return Object.fromEntries(
    (['attacker', 'defender'] as const).map(side => [
      side,
      {
        standIns: standIns[side],
        subtypes: collectDeclaredSubtypes(
          abilities[side],
          config[side],
          lookups[side],
        ),
      },
    ]),
  ) as OptionMetadata
}

function subtypes(metadata: OptionMetadata): DeclaredSubtype[][] {
  return [metadata.attacker.subtypes, metadata.defender.subtypes]
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
  state: OptionState,
  combatMode: CombatMode,
  scopedDefaults: boolean,
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

/** Keep a single choice's unit type when its surface is no longer offered
 *  (or a plain type default meets surface-qualified options). */
function relocateUnitTarget(value: string, validList: string[]): string {
  if (validList.includes(value)) return value
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
  state: OptionState,
  combatMode: CombatMode,
  scopedDefaults: boolean,
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
      if (surfaceScoped && !state.surfaces) {
        const keys = Array.isArray(currentValue)
          ? currentValue.map(entry =>
              typeof entry === 'string' ? entry : entry[0],
            )
          : [currentValue]
        if (keys.some(key => typeof key === 'string' && key.startsWith('@')))
          continue
      }
      const targetSide = sourceSide(side, source)
      const optionState = {
        ...state[targetSide],
        optionMetadata: sourceMetadata,
      }
      const options = resolveUnitOptions(
        optionState,
        {
          combatMode,
          activeSurfaceId: state.activeSurfaceId,
          surfaces: state.surfaces,
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
        },
      )
      const validList = options.map(option => option.value)
      const maxima = new Map(options.map(option => [option.value, option.max]))
      const maxFor = source.limit
        ? (key: string) => maxima.get(key as never) ?? Infinity
        : undefined
      if (Array.isArray(currentValue)) {
        abilityParams[source.key] = reconcileUnitListParam(
          currentValue as ([string] | [string, unknown])[],
          validList,
          source.defaultItemValue,
          maxFor,
        )
      } else if (typeof currentValue === 'string') {
        abilityParams[source.key] = reconcileStringParam(
          relocateUnitTarget(currentValue, validList),
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
  state: OptionState,
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
        const sideData = state[targetSide]
        // Clamp against the caps the controls offered, including projected
        // commitments; keys outside that catalog keep the physical cap.
        const maxima = new Map(
          (state.surfaces
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
            resolveVariantLimit(source.limit, sideData, entry[0] as never)
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
