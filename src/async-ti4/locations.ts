import factions from '@/data/faction'

import { FACTION_BY_ASYNC_ID, UNIT_TYPE_BY_ASYNC_ID } from './mappings'
import type { AsyncEntity, BattleLocation, WebData } from './types'

type EntityGroups = Record<string, AsyncEntity[]>

function isModelledUnit(entity: AsyncEntity): boolean {
  return (
    entity.entityType === 'unit' && entity.entityId in UNIT_TYPE_BY_ASYNC_ID
  )
}

/** AsyncTI4 faction ids present in a group, ordered by unit count descending so
 *  a location's label leads with whoever is actually holding it. */
function occupants(groups: EntityGroups): string[] {
  const totals = new Map<string, number>()
  for (const [asyncFaction, entities] of Object.entries(groups)) {
    let total = 0
    for (const entity of entities) {
      if (isModelledUnit(entity)) total += entity.count
    }
    if (total > 0) totals.set(asyncFaction, total)
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([asyncFaction]) => asyncFaction)
}

export function factionLabel(asyncFactionId: string): string {
  const key = FACTION_BY_ASYNC_ID[asyncFactionId]
  return key ? factions[key].name : asyncFactionId
}

function titleCase(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1)
}

/** The battle AsyncTI4 has open right now, resolved to a location id and the
 *  AsyncTI4 faction ids of its two participants (upstream identifies them by
 *  player colour). Returns `null` when no combat is live. */
export function findActiveCombat(data: WebData): {
  locationId: string
  factions: string[]
} | null {
  const combat = data.gameState?.activeCombat
  if (!combat?.system) return null

  const factionByColor = new Map(
    data.playerData.flatMap(p => (p.color ? [[p.color, p.faction]] : [])),
  )
  const factions = (combat.participantColors ?? [])
    .map(color => factionByColor.get(color))
    .filter((f): f is string => f !== undefined)

  // `unitHolder` names the planet, or `space` for the system's space area.
  const holder = combat.unitHolder
  return {
    locationId:
      !holder || holder === 'space'
        ? combat.system
        : `${combat.system}/${holder}`,
    factions,
  }
}

/** How readily a location suggests a battle worth simulating.
 *
 *  Two players sharing a space area means a fight — barring homebrew that
 *  allows coexistence there. Two players on a planet is a weaker signal: one
 *  side's structures can sit on ground the other holds without a shot being
 *  fired. Neither beats AsyncTI4 telling us outright which combat is open. */
function rank(location: BattleLocation): number {
  if (location.isActiveCombat) return 0
  if (location.factions.length < 2) return 3
  return location.mode === 'SPACE' ? 1 : 2
}

/** Every place in the game that holds units this calculator can model, ground
 *  locations split out per planet because ground combat is fought per planet.
 *  The likeliest battles sort first. */
export function listBattleLocations(data: WebData): BattleLocation[] {
  const locations: BattleLocation[] = []
  const activeId = findActiveCombat(data)?.locationId

  for (const [tile, tileData] of Object.entries(data.tileUnitData)) {
    const space = occupants(tileData.space ?? {})
    if (space.length > 0) {
      locations.push({
        id: tile,
        tile,
        label: `${tile} · space`,
        mode: 'SPACE',
        factions: space,
        isActiveCombat: tile === activeId,
      })
    }

    for (const [planet, planetData] of Object.entries(tileData.planets ?? {})) {
      const ground = occupants(planetData?.entities ?? {})
      if (ground.length === 0) continue
      locations.push({
        id: `${tile}/${planet}`,
        tile,
        planet,
        label: `${tile} · ${titleCase(planet)}`,
        mode: 'GROUND',
        factions: ground,
        isActiveCombat: `${tile}/${planet}` === activeId,
      })
    }
  }

  return locations.sort((a, b) => {
    const byRank = rank(a) - rank(b)
    if (byRank !== 0) return byRank
    return a.id.localeCompare(b.id, undefined, { numeric: true })
  })
}

/** The unit stacks one faction holds at a location, or an empty list when that
 *  faction isn't there — a side with no units on the map is a valid import,
 *  it just starts empty. */
export function entitiesAt(
  data: WebData,
  location: BattleLocation,
  asyncFactionId: string,
): AsyncEntity[] {
  const tileData = data.tileUnitData[location.tile]
  if (!tileData) return []
  const groups: EntityGroups = location.planet
    ? ((tileData.planets?.[location.planet]?.entities ?? {}) as EntityGroups)
    : ((tileData.space ?? {}) as EntityGroups)
  return groups[asyncFactionId] ?? []
}

/** Whether this calculator has a faction sheet for an AsyncTI4 faction id.
 *  AsyncTI4 carries Discordant Stars and a long tail of homebrew that this
 *  calculator doesn't model, and those players can't be imported. */
export function isMappedFaction(asyncFactionId: string): boolean {
  return asyncFactionId in FACTION_BY_ASYNC_ID
}
