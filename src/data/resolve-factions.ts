import type { RegisteredAbility } from '@/combat'
import type {
  Faction,
  FactionDefinition,
  LazyContext,
  UnitStatsInput,
} from '@/types'
import { factionSlot } from '@/utils/faction-slot'

import { collectFactionAbilities } from './collect-faction-abilities'

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

function reconcileStats(stats: UnitStatsInput, context: LazyContext): void {
  const initialize = stats.ABILITIES
  if (typeof initialize !== 'function') return
  // Consume the initializer before calling it so a lookup of this faction
  // can reconcile its other fields without restarting the current one.
  delete stats.ABILITIES
  stats.ABILITIES = initialize(context)
}

/** Resolve every lazy faction field against one shared dependency context.
 * Recursive lookups may finish dependencies early, but the returned roster is
 * always complete and contains no lazy initializers. */
export function resolveFactions<K extends string>(
  definitions: Readonly<Record<K, FactionDefinition>>,
  genericAbilities: readonly RegisteredAbility[],
): Readonly<Record<K, Faction>> {
  const keys = Object.keys(definitions) as K[]
  const genericKeys = new Set(genericAbilities.map(ability => ability.key))
  const working: Record<string, FactionDefinition> = Object.fromEntries(
    (Object.entries(definitions) as [K, FactionDefinition][]).map(
      ([key, definition]) => [
        key,
        {
          ...definition,
          units: Object.fromEntries(
            Object.entries(definition.units).map(([type, unit]) => [
              type,
              unit && {
                BASE: { ...unit.BASE },
                ...(unit.UPGRADED && { UPGRADED: { ...unit.UPGRADED } }),
              },
            ]),
          ),
        },
      ],
    ),
  )

  const reconcileFaction = (key: string, slot?: string): Faction => {
    const faction = working[key]
    if (!faction) throw new Error(`Faction "${key}" is not available`)

    for (const [type, unit] of Object.entries(faction.units)) {
      if (!unit || (slot !== undefined && factionSlot(type) !== slot)) {
        continue
      }
      reconcileStats(unit.BASE, context)
      if (unit.UPGRADED) reconcileStats(unit.UPGRADED, context)
    }

    // A lazy map must initialize together to discover its group names.
    const initialize = faction.abilities
    if (typeof initialize === 'function') {
      delete faction.abilities
      faction.abilities = initialize(context)
    }
    return faction as Faction
  }

  const context: LazyContext = {
    getFactionKeys: () => keys,
    getFaction: key => reconcileFaction(key),
    getAbilities: slot => {
      const result = genericAbilities.filter(ability => ability.slot === slot)
      if (!slot.startsWith('FACTION_')) return result
      for (const key of keys) {
        result.push(
          ...collectFactionAbilities(
            key,
            reconcileFaction(key, slot),
            genericKeys,
            slot,
          ),
        )
      }
      return uniqueAbilities(result)
    },
  }

  for (const key of keys) reconcileFaction(key)
  return working as Record<K, Faction>
}
