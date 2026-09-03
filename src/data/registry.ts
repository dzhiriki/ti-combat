import type { Ability, AbilitySlot, RegisteredAbility } from '@/combat'
import { FACTION_KEY_TO_SLOT, unitSlot } from '@/constants/ability-slots'
import type {
  DataRegistry,
  Faction,
  FactionAbilities,
  FactionDefinition,
  GameSystem,
  Lazy,
  UnitBaseType,
  UnitDefinition,
  UnitDefinitionInput,
  UnitStats,
  UnitStatsInput,
} from '@/types'

function isLazy<T>(
  value: Lazy<T> | undefined,
): value is (r: DataRegistry) => T {
  return typeof value === 'function'
}

function isLazyDefinition(def: FactionDefinition): boolean {
  if (isLazy(def.abilities)) return true
  for (const unit of Object.values(def.units)) {
    if (!unit) continue
    if (isLazy(unit.BASE.ABILITIES)) return true
    if (unit.UPGRADED && isLazy(unit.UPGRADED.ABILITIES)) return true
  }
  return false
}

function resolveStats(
  stats: UnitStatsInput,
  registry: DataRegistry,
): UnitStats {
  const { ABILITIES, ...rest } = stats
  return ABILITIES === undefined
    ? rest
    : {
        ...rest,
        ABILITIES: isLazy(ABILITIES) ? ABILITIES(registry) : ABILITIES,
      }
}

function resolveUnit(
  unit: UnitDefinitionInput,
  registry: DataRegistry,
): UnitDefinition {
  const base = resolveStats(unit.BASE, registry)
  if (!unit.UPGRADED) return { BASE: base }
  return {
    BASE: base,
    UPGRADED: resolveStats(
      unit.UPGRADED as UnitStatsInput,
      registry,
    ) as Partial<UnitStats>,
  }
}

function resolveDefinition(
  def: FactionDefinition,
  registry: DataRegistry,
): Faction {
  const units: Partial<Record<UnitBaseType, UnitDefinition>> = {}
  for (const [type, unit] of Object.entries(def.units) as [
    UnitBaseType,
    UnitDefinitionInput | undefined,
  ][]) {
    if (unit) units[type] = resolveUnit(unit, registry)
  }
  const abilities: FactionAbilities | undefined = isLazy(def.abilities)
    ? def.abilities(registry)
    : def.abilities
  return {
    name: def.name,
    ...(def.icon !== undefined && { icon: def.icon }),
    units,
    ...(abilities && { abilities }),
  }
}

function createRegistry(
  system: GameSystem,
  baseUnits: Readonly<Record<string, UnitDefinition>>,
  shared: readonly RegisteredAbility[],
  factions: Readonly<Record<string, Faction>>,
): DataRegistry {
  const cache = new Map<AbilitySlot, readonly Ability[]>()
  return {
    system,
    baseUnits,
    factions,
    getAbilities(slot) {
      let list = cache.get(slot)
      if (list !== undefined) return list
      const out: Ability[] = shared
        .filter(r => r.slot === slot)
        .map(r => r.ability)
      for (const faction of Object.values(factions)) {
        for (const [key, abilities] of Object.entries(
          faction.abilities ?? {},
        ) as [keyof FactionAbilities, readonly Ability[] | undefined][]) {
          if (abilities && FACTION_KEY_TO_SLOT[key] === slot)
            out.push(...abilities)
        }
        for (const [type, unit] of Object.entries(faction.units) as [
          UnitBaseType,
          UnitDefinition | undefined,
        ][]) {
          if (!unit || unitSlot(type) !== slot) continue
          out.push(
            ...(unit.BASE.ABILITIES ?? []),
            ...(unit.UPGRADED?.ABILITIES ?? []),
          )
        }
      }
      list = out
      cache.set(slot, list)
      return list
    },
  }
}

/** Resolve a system's faction definitions. Static factions (no lazy parts)
 *  form the registry; lazy factions are resolved against it, in definition
 *  order, and the result keeps the definition key order. */
export function resolveFactions<K extends string>(
  system: GameSystem,
  baseUnits: Readonly<Record<string, UnitDefinition>>,
  shared: readonly RegisteredAbility[],
  definitions: Readonly<Record<K, FactionDefinition>>,
): Readonly<Record<K, Faction>> {
  const statics: Record<string, Faction> = {}
  const entries = Object.entries(definitions) as [K, FactionDefinition][]
  for (const [key, def] of entries) {
    if (!isLazyDefinition(def)) statics[key] = def as Faction
  }
  const registry = createRegistry(system, baseUnits, shared, statics)
  const out = {} as Record<K, Faction>
  for (const [key, def] of entries) {
    out[key] = Object.hasOwn(statics, key)
      ? statics[key]
      : resolveDefinition(def, registry)
  }
  return out
}
