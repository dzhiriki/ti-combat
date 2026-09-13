import {
  type Ability,
  hasStaticInvokes,
  type RegisteredAbility,
} from '@/combat'
import { UNIT_TYPES } from '@/constants/units'
import type {
  AbilitySlotData,
  CombatSide,
  Faction,
  FactionDefinition,
  GameData,
  GameSystem,
  SlotDisplay,
  UnitBaseType,
  UnitDefinition,
  UnitStats,
} from '@/types'

import { resolveFactions } from './registry'

interface CrossFactionPool {
  factionGroup: string
  slot: string
}

interface ExternalAbilityPool {
  slot: string
}

interface NeutralAvailability {
  hiddenSlots?: readonly string[]
  hiddenAbilityKeys?: readonly string[]
}

export interface CreateGameDataOptions<
  FactionKey extends string = string,
> extends AbilitySlotData {
  id: GameSystem
  label: string
  defaultFaction?: FactionKey
  factionDefinitions: Readonly<Record<FactionKey, FactionDefinition>>
  baseUnits: Readonly<Record<string, UnitDefinition>>
  sharedAbilities: readonly RegisteredAbility[]
  SLOT_DISPLAY: Readonly<Record<string, SlotDisplay>>
  SLOT_ORDER: readonly string[]
  sharedUnitAbilityKeys?: ReadonlySet<string>
  crossFactionPools?: readonly CrossFactionPool[]
  externalAbilityPool?: ExternalAbilityPool
  omitOwnFactionGroups?: readonly string[]
  ownFactionSlotOverrides?: Readonly<Record<string, string>>
  neutral?: NeutralAvailability
}

type SystemGameData<FactionKey extends string> = GameData & {
  factions: Readonly<Record<FactionKey, Faction>>
}

function hasExternalInvoke(ability: Ability): boolean {
  return (
    hasStaticInvokes(ability) &&
    ability.invoke.some(invoke => invoke.external === true)
  )
}

function getEffectiveStats(
  base: UnitStats,
  upgraded: Partial<UnitStats> | undefined,
  isUpgraded: boolean,
): UnitStats {
  if (!isUpgraded || !upgraded) return { ...base }
  return {
    ...base,
    ...upgraded,
    UNIT_ABILITIES: {
      ...base.UNIT_ABILITIES,
      ...upgraded.UNIT_ABILITIES,
    },
  }
}

/**
 * Builds the complete public entry point for one game system. The same
 * GameData object is used while resolving lazy factions and at runtime.
 */
export function createGameData<FactionKey extends string>(
  options: CreateGameDataOptions<FactionKey>,
): SystemGameData<FactionKey> {
  let registeredAbilities: readonly RegisteredAbility[] =
    options.sharedAbilities

  const getAbilities = (slot: string): readonly Ability[] => {
    const result = options.sharedAbilities
      .filter(entry => entry.slot === slot)
      .map(entry => entry.ability)

    for (const faction of Object.values(gameData.factions)) {
      for (const [group, abilities] of Object.entries(
        faction.abilities ?? {},
      )) {
        if (options.FACTION_KEY_TO_SLOT[group] === slot) {
          result.push(...abilities)
        }
      }
      for (const [type, unit] of Object.entries(faction.units) as [
        UnitBaseType,
        UnitDefinition | undefined,
      ][]) {
        if (!unit || options.unitSlot(type) !== slot) continue
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
        options.baseUnits[unitType] ?? { BASE: {} }
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

  const collectUnitAbilities = (
    faction: Faction,
    side: CombatSide,
    upgradedTypes?: ReadonlySet<UnitBaseType>,
  ): RegisteredAbility[] => {
    const seen = new Set<string>()
    const result: RegisteredAbility[] = []

    for (const [unitTypeKey, unit] of Object.entries(faction.units)) {
      if (!unit) continue
      const unitType = unitTypeKey as UnitBaseType
      const slot = options.unitSlot(unitType)
      for (const ability of [
        ...(unit.BASE.ABILITIES ?? []),
        ...(unit.UPGRADED?.ABILITIES ?? []),
      ]) {
        if (options.sharedUnitAbilityKeys?.has(ability.key)) continue
        if (seen.has(ability.key)) continue
        if (!ability.headerUI && !ability.uiConfig) continue
        if (ability.side && ability.side !== side) continue
        seen.add(ability.key)
        result.push({ ability, slot })
      }

      const effective = getEffectiveStats(
        unit.BASE,
        unit.UPGRADED,
        upgradedTypes?.has(unitType) ?? false,
      )
      const deploy = effective.UNIT_ABILITIES?.DEPLOY
      if (
        deploy &&
        !seen.has(deploy.key) &&
        (deploy.headerUI || deploy.uiConfig) &&
        (!deploy.side || deploy.side === side)
      ) {
        seen.add(deploy.key)
        result.push({ ability: deploy, slot })
      }
    }

    return result
  }

  const neutralHiddenSlots = new Set(options.neutral?.hiddenSlots ?? [])
  const neutralHiddenAbilityKeys = new Set(
    options.neutral?.hiddenAbilityKeys ?? [],
  )
  const omittedOwnGroups = new Set(options.omitOwnFactionGroups ?? [])

  const getAvailableAbilities = (
    side: CombatSide,
    factionKey: string,
    upgradedTypes?: ReadonlySet<UnitBaseType>,
  ): RegisteredAbility[] => {
    const faction = getFaction(factionKey)
    const ownedKeys = getFactionOwnedAbilityKeys(factionKey)
    const isNeutral = factionKey === 'NEUTRAL'

    const base = registeredAbilities.filter(entry => {
      const ability = entry.ability
      if (ability.side && ability.side !== side) return false
      if (isNeutral) {
        if (neutralHiddenSlots.has(entry.slot)) return false
        if (neutralHiddenAbilityKeys.has(ability.key)) return false
      }
      if (
        options.externalAbilityPool &&
        entry.slot === options.externalAbilityPool.slot &&
        ownedKeys.has(ability.key)
      ) {
        return false
      }
      return true
    })

    const factionAbilities: RegisteredAbility[] = []
    for (const [group, list] of Object.entries(faction.abilities ?? {})) {
      if (!Object.hasOwn(options.FACTION_KEY_TO_SLOT, group)) {
        throw new Error(
          `Faction ability group "${group}" on "${factionKey}" is not supported by ${options.id}`,
        )
      }
      if (omittedOwnGroups.has(group)) continue
      const slot =
        options.ownFactionSlotOverrides?.[group] ??
        options.FACTION_KEY_TO_SLOT[group]
      for (const ability of list) {
        if (ability.side && ability.side !== side) continue
        factionAbilities.push({ ability, slot })
      }
    }

    return [
      ...base,
      ...factionAbilities,
      ...collectUnitAbilities(faction, side, upgradedTypes),
    ]
  }

  const gameData: GameData = {
    id: options.id,
    label: options.label,
    defaultFaction: options.defaultFaction ?? 'NEUTRAL',
    factions: {},
    baseUnits: options.baseUnits,
    abilities: registeredAbilities,
    allAbilities: [],
    FACTION_KEY_TO_SLOT: options.FACTION_KEY_TO_SLOT,
    unitSlot: options.unitSlot,
    SLOT_DISPLAY: options.SLOT_DISPLAY,
    SLOT_ORDER: options.SLOT_ORDER,
    getAbilities,
    getFaction,
    getFactionUnitConfig,
    getAvailableAbilities,
    getUnitDefinitionAbilityKeys,
    getFactionOwnedAbilityKeys,
  }

  const factions = resolveFactions(gameData, options.factionDefinitions)
  const resolvedFactions = Object.values(factions) as Faction[]

  const crossFactionAbilities = (options.crossFactionPools ?? []).flatMap(
    pool =>
      resolvedFactions.flatMap(faction =>
        (faction.abilities?.[pool.factionGroup] ?? []).map(ability => ({
          ability,
          slot: pool.slot,
        })),
      ),
  )

  const displayedKeys = new Set([
    ...options.sharedAbilities.map(entry => entry.ability.key),
    ...crossFactionAbilities.map(entry => entry.ability.key),
  ])

  const externalAbilities: RegisteredAbility[] = []
  if (options.externalAbilityPool) {
    const seen = new Set<string>()
    const add = (ability: Ability, faction: Faction) => {
      if (!hasExternalInvoke(ability)) return
      if (seen.has(ability.key) || displayedKeys.has(ability.key)) return
      if (!ability.headerUI && !ability.uiConfig) return
      seen.add(ability.key)
      externalAbilities.push({
        ability: { ...ability, icon: faction.icon },
        slot: options.externalAbilityPool!.slot,
      })
    }

    for (const faction of resolvedFactions) {
      for (const unit of Object.values(faction.units)) {
        if (!unit) continue
        for (const ability of [
          ...(unit.BASE.ABILITIES ?? []),
          ...(unit.UPGRADED?.ABILITIES ?? []),
        ]) {
          add(ability, faction)
        }
      }
      for (const abilities of Object.values(faction.abilities ?? {})) {
        for (const ability of abilities) add(ability, faction)
      }
    }
  }

  registeredAbilities = [
    ...options.sharedAbilities,
    ...crossFactionAbilities,
    ...externalAbilities,
  ]

  const allAbilities: Ability[] = registeredAbilities.map(
    entry => entry.ability,
  )
  for (const faction of resolvedFactions) {
    for (const unit of Object.values(faction.units)) {
      if (!unit) continue
      for (const ability of [
        ...(unit.BASE.ABILITIES ?? []),
        ...(unit.UPGRADED?.ABILITIES ?? []),
      ]) {
        if (ability.headerUI || ability.uiConfig) allAbilities.push(ability)
      }
      for (const stats of [unit.BASE, unit.UPGRADED]) {
        const deploy = stats?.UNIT_ABILITIES?.DEPLOY
        if (deploy && (deploy.headerUI || deploy.uiConfig)) {
          allAbilities.push(deploy)
        }
      }
    }
    for (const list of Object.values(faction.abilities ?? {})) {
      allAbilities.push(...list)
    }
  }

  Object.assign(gameData, {
    defaultFaction:
      options.defaultFaction ?? Object.keys(factions)[0] ?? 'NEUTRAL',
    factions,
    abilities: registeredAbilities,
    allAbilities,
  })

  return gameData as SystemGameData<FactionKey>
}
