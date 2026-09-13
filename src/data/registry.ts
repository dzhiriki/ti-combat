import type {
  Faction,
  FactionAbilities,
  FactionDefinition,
  GameData,
  Lazy,
  UnitBaseType,
  UnitDefinition,
  UnitDefinitionInput,
  UnitStats,
  UnitStatsInput,
} from '@/types'

function isLazy<T>(
  value: Lazy<T> | undefined,
): value is (gameData: GameData) => T {
  return typeof value === 'function'
}

function isLazyDefinition(definition: FactionDefinition): boolean {
  if (isLazy(definition.abilities)) return true
  for (const unit of Object.values(definition.units)) {
    if (!unit) continue
    if (isLazy(unit.BASE.ABILITIES)) return true
    if (unit.UPGRADED && isLazy(unit.UPGRADED.ABILITIES)) return true
  }
  return false
}

function resolveStats(stats: UnitStatsInput, gameData: GameData): UnitStats {
  const { ABILITIES, ...rest } = stats
  return ABILITIES === undefined
    ? rest
    : {
        ...rest,
        ABILITIES: isLazy(ABILITIES) ? ABILITIES(gameData) : ABILITIES,
      }
}

function resolveUnit(
  unit: UnitDefinitionInput,
  gameData: GameData,
): UnitDefinition {
  const base = resolveStats(unit.BASE, gameData)
  if (!unit.UPGRADED) return { BASE: base }
  return {
    BASE: base,
    UPGRADED: resolveStats(
      unit.UPGRADED as UnitStatsInput,
      gameData,
    ) as Partial<UnitStats>,
  }
}

function resolveDefinition(
  definition: FactionDefinition,
  gameData: GameData,
): Faction {
  const units: Partial<Record<UnitBaseType, UnitDefinition>> = {}
  for (const [type, unit] of Object.entries(definition.units) as [
    UnitBaseType,
    UnitDefinitionInput | undefined,
  ][]) {
    if (unit) units[type] = resolveUnit(unit, gameData)
  }
  const abilities: FactionAbilities | undefined = isLazy(definition.abilities)
    ? definition.abilities(gameData)
    : definition.abilities
  return {
    name: definition.name,
    ...(definition.icon !== undefined && { icon: definition.icon }),
    units,
    ...(abilities && { abilities }),
  }
}

function assertFactionAbilityGroups(
  gameData: GameData,
  factionKey: string,
  faction: Faction,
): void {
  for (const key of Object.keys(faction.abilities ?? {})) {
    if (Object.hasOwn(gameData.FACTION_KEY_TO_SLOT, key)) continue
    throw new Error(
      `Faction ability group "${key}" on "${factionKey}" is not supported by ${gameData.id}`,
    )
  }
}

function setFactions(
  gameData: GameData,
  factions: Readonly<Record<string, Faction>>,
): void {
  Object.assign(gameData, { factions })
}

/**
 * Resolve a system's faction definitions against its GameData entity. Static
 * factions are installed first, so lazy factions can inspect them without
 * observing other lazy factions. The same entity receives the final roster.
 */
export function resolveFactions<K extends string>(
  gameData: GameData,
  definitions: Readonly<Record<K, FactionDefinition>>,
): Readonly<Record<K, Faction>> {
  const statics: Record<string, Faction> = {}
  const entries = Object.entries(definitions) as [K, FactionDefinition][]
  for (const [key, definition] of entries) {
    if (!isLazyDefinition(definition)) {
      const faction = definition as Faction
      assertFactionAbilityGroups(gameData, key, faction)
      statics[key] = faction
    }
  }

  setFactions(gameData, statics)

  const resolved = {} as Record<K, Faction>
  for (const [key, definition] of entries) {
    const faction = Object.hasOwn(statics, key)
      ? statics[key]
      : resolveDefinition(definition, gameData)
    assertFactionAbilityGroups(gameData, key, faction)
    resolved[key] = faction
  }

  setFactions(gameData, resolved)
  return resolved
}
