import { type Ability, hasStaticInvokes } from '@/combat'
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

/** One slot of the config, flattened out of its category. */
type ResolvedSlot = Omit<CollectedAbility, 'ability' | 'factionKey' | 'deploy'>

/** Flattens a slot config into the entries abilities are matched against. */
function resolveSlots(slots: readonly SlotEntry[]): ResolvedSlot[] {
  const resolved: ResolvedSlot[] = []
  const seen = new Set<string>()

  let order = 0
  for (const entry of slots) {
    const isCategory = 'items' in entry
    for (const item of isCategory ? entry.items : [entry]) {
      // An entry may feed one sub-header from several slots (the unit slots
      // under FACTION/UNIT), which then share its title and render order.
      for (const slot of typeof item.slot === 'string'
        ? [item.slot]
        : item.slot) {
        // A slot may appear under two strategies — own commanders render
        // under FACTION, everyone else's under COMMANDER — but not twice
        // under the same one.
        const key = `${slot}:${item.strategy ?? ''}`
        if (seen.has(key)) {
          throw new Error(`Duplicate slot "${slot}" in slot config`)
        }
        seen.add(key)
        resolved.push({
          slot,
          ...(item.strategy && { strategy: item.strategy }),
          neutral: item.neutral ?? entry.neutral ?? true,
          display: {
            category: entry.title,
            ...(isCategory && { subcategory: item.title }),
            order,
            icon: item.icon ?? entry.icon ?? true,
          },
        })
      }
      order++
    }
  }

  return resolved
}

function hasExternalInvoke(ability: Ability): boolean {
  return (
    hasStaticInvokes(ability) &&
    ability.invoke.some(invoke => invoke.external === true)
  )
}

function hasUI(ability: Ability): boolean {
  return Boolean(ability.headerUI || ability.uiConfig)
}

/** Does this slot entry show `entry` to the faction being configured? */
function shows(entry: CollectedAbility, factionKey: string): boolean {
  switch (entry.strategy) {
    case 'OWN':
      return entry.factionKey === factionKey
    case 'OTHER':
      return entry.factionKey !== factionKey
    // ALL, or a shared deck.
    default:
      return true
  }
}

/**
 * Builds the complete public entry point for one game system. The same
 * GameData object is used while resolving lazy factions and at runtime.
 */
export function createGameData(options: CreateGameDataOptions): GameData {
  const slots = resolveSlots(options.slots)
  const external = slots.find(entry => entry.slot === EXTERNAL_SLOT)
  const collected: CollectedAbility[] = []

  /**
   * Pair an ability with every config entry showing its slot. Shared decks
   * belong to entries without a strategy, faction-owned abilities to entries
   * with one — an ability nobody would ever show is a data error.
   */
  const collect = (
    ability: Ability,
    slot: string,
    owner: Pick<CollectedAbility, 'factionKey' | 'deploy'> = {},
  ): void => {
    const owned = owner.factionKey !== undefined
    const homes = slots.filter(
      entry => entry.slot === slot && (entry.strategy !== undefined) === owned,
    )
    if (homes.length === 0) {
      throw new Error(
        `Slot "${slot}" of "${ability.key}" is not declared by ${options.id}`,
      )
    }
    for (const home of homes) collected.push({ ...home, ability, ...owner })
  }

  for (const [slot, deck] of Object.entries(options.abilities)) {
    for (const ability of deck) collect(ability, slot)
  }
  const sharedKeys = new Set(collected.map(entry => entry.ability.key))

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

  const getAbilities = (slot: string): readonly Ability[] => {
    const result = [...(options.abilities[slot] ?? [])]

    for (const faction of Object.values(gameData.factions)) {
      for (const [group, abilities] of Object.entries(
        faction.abilities ?? {},
      )) {
        if (factionSlot(group) === slot) {
          result.push(...abilities)
        }
      }
      for (const [type, unit] of Object.entries(faction.units) as [
        UnitBaseType,
        UnitDefinition | undefined,
      ][]) {
        if (!unit || factionSlot(type) !== slot) continue
        result.push(
          ...(unit.BASE.ABILITIES ?? []),
          ...(unit.UPGRADED?.ABILITIES ?? []),
        )
      }
    }

    return result
  }

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
    const isNeutral = factionKey === 'NEUTRAL'
    const result: CollectedAbility[] = []
    const shown = new Set<string>()

    // Registration order — not config order — drives invoke resolution, so
    // the collected list is walked as is; the config only decided where each
    // entry may show.
    for (const entry of collected) {
      const ability = entry.ability
      if (!shows(entry, factionKey)) continue
      if (isNeutral && (!entry.neutral || ability.neutral === false)) continue
      if (ability.side && ability.side !== side) continue
      if (
        entry.deploy &&
        !(upgradedTypes?.has(entry.deploy.unitType)
          ? entry.deploy.upgraded
          : entry.deploy.base)
      ) {
        continue
      }
      shown.add(ability.key)
      result.push(entry)
    }

    if (!external) return result

    // Whatever no entry showed, but that reaches across the table anyway.
    for (const entry of collected) {
      const ability = entry.ability
      if (entry.factionKey === undefined || entry.factionKey === factionKey) {
        continue
      }
      if (shown.has(ability.key) || !hasUI(ability)) continue
      if (!hasExternalInvoke(ability)) continue
      shown.add(ability.key)
      const icon = gameData.factions[entry.factionKey]?.icon
      result.push({
        ...external,
        ability: { ...ability, ...(icon && { icon }) },
        factionKey: entry.factionKey,
      })
    }

    return result
  }

  const gameData: GameData = {
    id: options.id,
    label: options.label,
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

  const factions = resolveFactions(gameData, options.factions)

  for (const [factionKey, faction] of Object.entries(factions)) {
    for (const group of Object.keys(faction.abilities ?? {})) {
      if (slots.some(slot => slot.slot === factionSlot(group))) continue
      throw new Error(
        `Faction ability group "${group}" on "${factionKey}" is not supported by ${options.id}`,
      )
    }
    collectFaction(factionKey, faction)
  }

  const allAbilities: Ability[] = []
  const seenKeys = new Set<string>()
  for (const entry of collected) {
    if (seenKeys.has(entry.ability.key)) continue
    seenKeys.add(entry.ability.key)
    allAbilities.push(entry.ability)
  }

  Object.assign(gameData, { factions, allAbilities })

  return gameData
}
