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

import { resolveFactions } from './registry'

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

/**
 * Builds the complete public entry point for one game system. The same
 * GameData object is used while resolving lazy factions and at runtime.
 */
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
  const collected: CollectedAbility[] = []

  /**
   * Register each ability once, independently of its presentation. Shared decks
   * belong to entries without a strategy, faction-owned abilities to entries
   * with one — an ability nobody would ever show is a data error.
   */
  const collect = (
    ability: Ability,
    slot: string,
    owner: Pick<CollectedAbility, 'factionKey' | 'deploy'> = {},
  ): void => {
    const owned = owner.factionKey !== undefined
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
    collected.push({ ...ability, slot, ...owner })
  }

  for (const [slot, deck] of Object.entries(options.abilities)) {
    for (const ability of deck) collect(ability, slot)
  }
  const sharedCount = collected.length
  const sharedKeys = new Set(collected.map(entry => entry.key))

  /**
   * Every ability a faction owns: its ability groups, plus the abilities
   * printed on its units. Unit abilities a shared deck already registers
   * (Sustain Damage) or that carry no controls are dropped — they are never
   * configured per faction.
   */
  const collectFaction = (factionKey: string, faction: Faction): void => {
    for (const [group, list] of Object.entries(faction.abilities ?? {})) {
      for (const ability of list) {
        collect(ability, factionSlot(group), { factionKey })
      }
    }

    const seen = new Set<string>()
    for (const [unitTypeKey, unit] of Object.entries(faction.units)) {
      if (!unit) continue
      const unitType = unitTypeKey as UnitBaseType
      const slot = factionSlot(unitType)
      for (const ability of [
        ...(unit.BASE.ABILITIES ?? []),
        ...(unit.UPGRADED?.ABILITIES ?? []),
      ]) {
        if (sharedKeys.has(ability.key)) continue
        if (seen.has(ability.key) || !hasUI(ability)) continue
        seen.add(ability.key)
        collect(ability, slot, { factionKey })
      }

      // An upgraded DEPLOY replaces the base one on upgraded builds, the same
      // way `getEffectiveStats` merges UNIT_ABILITIES.
      const base = unit.BASE.UNIT_ABILITIES?.DEPLOY
      const upgraded = unit.UPGRADED?.UNIT_ABILITIES?.DEPLOY
      for (const [ability, deploy] of [
        [base, { unitType, base: true, upgraded: !upgraded }],
        [upgraded, { unitType, base: false, upgraded: true }],
      ] as const) {
        if (!ability || seen.has(ability.key) || !hasUI(ability)) continue
        seen.add(ability.key)
        collect(ability, slot, { factionKey, deploy })
      }
    }
  }

  const getAbilities = (slot: string): readonly RegisteredAbility[] =>
    gameData.allAbilities.filter(ability => ability.slot === slot)

  const getFaction = (factionKey: string): Faction => {
    if (!Object.hasOwn(gameData.factions, factionKey)) {
      throw new Error(
        `Faction "${factionKey}" is not available in ${options.id}`,
      )
    }
    return gameData.factions[factionKey]
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
      const icon = gameData.factions[entry.factionKey]?.icon
      result.push({ ...external, ...(icon && { icon }) })
    }

    return result
  }

  const gameData: GameData = {
    id: options.id,
    label: options.label,
    slots: options.slots,
    defaultFaction: Object.keys(options.factions)[0] ?? 'NEUTRAL',
    factions: {},
    baseUnits: options.units,
    allAbilities: [],
    getAbilities,
    getFaction,
    getFactionUnitConfig,
    getAvailableAbilities,
    getUnitDefinitionAbilityKeys,
    getFactionOwnedAbilityKeys,
  }

  resolveFactions(gameData, options.factions, factions => {
    // Install static abilities before lazy factions read them, then rebuild
    // in the complete roster's order so invoke resolution keeps that order.
    collected.length = sharedCount
    for (const [factionKey, faction] of Object.entries(factions)) {
      for (const group of Object.keys(faction.abilities ?? {})) {
        if (
          slots.some(config =>
            typeof config.slot === 'string'
              ? config.slot === factionSlot(group)
              : config.slot.includes(factionSlot(group)),
          )
        )
          continue
        throw new Error(
          `Faction ability group "${group}" on "${factionKey}" is not supported by ${options.id}`,
        )
      }
      collectFaction(factionKey, faction)
    }

    const allAbilities: RegisteredAbility[] = []
    const seenKeys = new Set<string>()
    for (const entry of collected) {
      if (seenKeys.has(entry.key)) continue
      seenKeys.add(entry.key)
      allAbilities.push(entry)
    }

    Object.assign(gameData, { allAbilities })
  })

  return gameData
}
