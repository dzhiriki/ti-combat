import {
  type Ability,
  hasStaticInvokes,
  type RegisteredAbility,
} from '@/combat'
import { UNIT_TYPES } from '@/constants/units'
import type {
  CollectedAbility,
  CombatSide,
  Faction,
  FactionDefinition,
  GameData,
  GameSystem,
  SlotEntry,
  UnitBaseType,
  UnitDefinition,
} from '@/types'
import { factionSlot } from '@/utils/faction-slot'
import { matchesAbilitySlot } from '@/utils/matches-ability-slot'

import { collectFactionAbilities } from './collect-faction-abilities'
import { resolveFactions } from './resolve-factions'

export interface CreateGameDataOptions {
  id: GameSystem
  label: string
  /** The roster; the first faction is the system's default selection. */
  factions: Readonly<Record<string, FactionDefinition>>
  /** Generic unit stats a faction inherits where it defines nothing. */
  units: Readonly<Partial<Record<UnitBaseType, UnitDefinition>>>
  /**
   * The shared decks, keyed by slot. Key order is registration order, which
   * drives invoke resolution within a timing pass.
   */
  abilities: Readonly<Record<string, readonly Ability[]>>
  slots: readonly SlotEntry[]
}

/**
 * Abilities a faction owns but the slot config never shows land here, so an
 * opponent's cross-table effects stay configurable. Systems opt in by
 * declaring the slot.
 */
const EXTERNAL_SLOT = 'OTHER'

function hasExternalInvoke(ability: Ability): boolean {
  return (
    hasStaticInvokes(ability) &&
    ability.invoke.some(invoke => invoke.external === true)
  )
}

function hasUI(ability: Ability): boolean {
  return Boolean(ability.headerUI || ability.uiConfig)
}

function uniqueAbilities(
  abilities: readonly RegisteredAbility[],
): RegisteredAbility[] {
  const seen = new Set<string>()
  return abilities.filter(ability => {
    if (seen.has(ability.key)) return false
    seen.add(ability.key)
    return true
  })
}

/** Builds the runtime entry point after lazy fields and their dependencies
 *  have reconciled through the minimal lazy context. */
export function createGameData(options: CreateGameDataOptions): GameData {
  const slots = options.slots.flatMap(entry =>
    'items' in entry ? entry.items : [entry],
  )
  const declared = new Set<string>()
  for (const config of slots) {
    for (const slot of typeof config.slot === 'string'
      ? [config.slot]
      : config.slot) {
      const key = `${slot}:${config.strategy ?? ''}`
      if (declared.has(key)) {
        throw new Error(`Duplicate slot "${slot}" in slot config`)
      }
      declared.add(key)
    }
  }
  const isAvailable = (
    ability: CollectedAbility,
    factionKey: string,
  ): boolean =>
    options.slots.some(entry =>
      'items' in entry
        ? entry.items.some(item =>
            matchesAbilitySlot(ability, item, factionKey, entry.neutral),
          )
        : matchesAbilitySlot(ability, entry, factionKey),
    )
  const hasSlot = (slot: string): boolean =>
    slots.some(config =>
      typeof config.slot === 'string'
        ? config.slot === slot
        : config.slot.includes(slot),
    )

  const assertSlot = (ability: Ability, slot: string, owned: boolean): void => {
    if (
      !slots.some(
        entry =>
          (typeof entry.slot === 'string'
            ? entry.slot === slot
            : entry.slot.includes(slot)) &&
          (entry.strategy !== undefined) === owned,
      )
    ) {
      throw new Error(
        `Slot "${slot}" of "${ability.key}" is not declared by ${options.id}`,
      )
    }
  }

  const genericAbilities: CollectedAbility[] = []
  for (const [slot, deck] of Object.entries(options.abilities)) {
    for (const ability of deck) {
      assertSlot(ability, slot, false)
      genericAbilities.push({ ...ability, slot })
    }
  }
  const genericAbilityKeys = new Set(
    genericAbilities.map(ability => ability.key),
  )

  const factions = resolveFactions(options.factions, genericAbilities)

  // Dependency order does not change registration order. Collect once after
  // every field has finished, with generic abilities ahead of the roster.
  const collected = [...genericAbilities]
  for (const [key, faction] of Object.entries(factions)) {
    for (const group of Object.keys(faction.abilities ?? {})) {
      if (hasSlot(factionSlot(group))) continue
      throw new Error(
        `Faction ability group "${group}" on "${key}" is not supported by ${options.id}`,
      )
    }
    for (const ability of collectFactionAbilities(
      key,
      faction,
      genericAbilityKeys,
    )) {
      assertSlot(ability, ability.slot, true)
      collected.push(ability)
    }
  }
  const allAbilities = uniqueAbilities(collected)

  const getAbilities = (slot: string): readonly RegisteredAbility[] =>
    allAbilities.filter(ability => ability.slot === slot)

  const getFaction = (factionKey: string): Faction => {
    const faction = factions[factionKey]
    if (!faction) {
      throw new Error(
        `Faction "${factionKey}" is not available in ${options.id}`,
      )
    }
    return faction
  }

  const getFactionUnitConfig = (
    factionKey: string,
  ): Record<UnitBaseType, UnitDefinition> => {
    const factionUnits = getFaction(factionKey).units
    const result = {} as Record<UnitBaseType, UnitDefinition>
    for (const unitType of UNIT_TYPES) {
      result[unitType] = factionUnits[unitType] ??
        options.units[unitType] ?? { BASE: {} }
    }
    return result
  }

  const unitDefinitionAbilityKeysCache = new Map<string, ReadonlySet<string>>()
  const getUnitDefinitionAbilityKeys = (
    factionKey: string,
  ): ReadonlySet<string> => {
    const cached = unitDefinitionAbilityKeysCache.get(factionKey)
    if (cached) return cached
    const keys = new Set<string>()
    for (const unit of Object.values(getFactionUnitConfig(factionKey))) {
      for (const ability of [
        ...(unit.BASE.ABILITIES ?? []),
        ...(unit.UPGRADED?.ABILITIES ?? []),
      ]) {
        keys.add(ability.key)
      }
      for (const stats of [unit.BASE, unit.UPGRADED]) {
        const deploy = stats?.UNIT_ABILITIES?.DEPLOY
        if (deploy) keys.add(deploy.key)
      }
    }
    unitDefinitionAbilityKeysCache.set(factionKey, keys)
    return keys
  }

  const factionOwnedAbilityKeysCache = new Map<string, ReadonlySet<string>>()
  const getFactionOwnedAbilityKeys = (
    factionKey: string,
  ): ReadonlySet<string> => {
    const cached = factionOwnedAbilityKeysCache.get(factionKey)
    if (cached) return cached
    const keys = new Set(getUnitDefinitionAbilityKeys(factionKey))
    for (const list of Object.values(getFaction(factionKey).abilities ?? {})) {
      for (const ability of list) keys.add(ability.key)
    }
    factionOwnedAbilityKeysCache.set(factionKey, keys)
    return keys
  }

  const getAvailableAbilities = (
    side: CombatSide,
    factionKey: string,
    upgradedTypes?: ReadonlySet<UnitBaseType>,
  ): CollectedAbility[] => {
    getFaction(factionKey)
    const result: CollectedAbility[] = []
    const shown = new Set<string>()

    // Registration order — not config order — drives invoke resolution, so
    // the collected list is walked as is; the config only decided where each
    // entry may show.
    for (const entry of collected) {
      if (!isAvailable(entry, factionKey)) continue
      if (entry.side && entry.side !== side) continue
      if (
        entry.deploy &&
        !(upgradedTypes?.has(entry.deploy.unitType)
          ? entry.deploy.upgraded
          : entry.deploy.base)
      ) {
        continue
      }
      shown.add(entry.key)
      result.push(entry)
    }

    // Whatever no entry showed, but that reaches across the table anyway.
    for (const entry of collected) {
      if (entry.factionKey === undefined || entry.factionKey === factionKey) {
        continue
      }
      if (shown.has(entry.key) || !hasUI(entry)) continue
      if (!hasExternalInvoke(entry)) continue
      const external = { ...entry, slot: EXTERNAL_SLOT }
      if (!isAvailable(external, factionKey)) continue
      shown.add(entry.key)
      const icon = factions[entry.factionKey]?.icon
      result.push({ ...external, ...(icon && { icon }) })
    }

    return result
  }

  return {
    id: options.id,
    label: options.label,
    slots: options.slots,
    defaultFaction: Object.keys(options.factions)[0] ?? 'NEUTRAL',
    factions,
    baseUnits: options.units,
    allAbilities,
    getAbilities,
    getFaction,
    getFactionUnitConfig,
    getAvailableAbilities,
    getUnitDefinitionAbilityKeys,
    getFactionOwnedAbilityKeys,
  }
}
