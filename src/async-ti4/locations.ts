import { UNIT_SHORT_NAMES, UNIT_TYPES } from '@/constants/units'
import factions from '@/data/faction'
import type { UnitBaseType } from '@/types'

import {
  ENVIRONMENT_BY_TILE,
  FACTION_BY_ASYNC_ID,
  UNIT_TYPE_BY_ASYNC_ID,
} from './mappings'
import { PLANET_NAMES, SPACE_STATIONS } from './planet-names'
import { TILE_NAMES, UNPLAYABLE_TILES } from './tile-names'
import type { AsyncEntity, BattleLocation, WebData } from './types'

type EntityGroups = Record<string, AsyncEntity[]>

function isModelledUnit(entity: AsyncEntity): boolean {
  return (
    entity.entityType === 'unit' && entity.entityId in UNIT_TYPE_BY_ASYNC_ID
  )
}

interface Occupancy {
  /** AsyncTI4 faction ids, ordered by unit count descending so a location's
   *  label leads with whoever is actually holding it. */
  factions: string[]
  unitCount: number
  unitSummary: string
}

/** The units here in the notation the outcomes table uses: a short unit name,
 *  a count in front of it when there is more than one, and a trailing `-` on a
 *  damaged stack. Ordered like every other unit list in the app. */
function summariseUnits(
  healthy: Map<UnitBaseType, number>,
  damaged: Map<UnitBaseType, number>,
): string {
  const parts: string[] = []
  for (const type of UNIT_TYPES) {
    const name = UNIT_SHORT_NAMES[type]
    const alive = healthy.get(type) ?? 0
    const hurt = damaged.get(type) ?? 0
    if (alive > 0) parts.push(alive > 1 ? `${alive}${name}` : name)
    if (hurt > 0) parts.push(hurt > 1 ? `${hurt}${name}-` : `${name}-`)
  }
  return parts.join(', ')
}

/** `owner` restricts a planet to the forces of whoever controls it. Landing
 *  troops means fighting the owner for control, not the players coexisting
 *  alongside them, so nobody else's units here are part of the defence.
 *
 *  An owner with no units on their own planet needs no handling: a coexisting
 *  player would have taken control of it. */
function occupants(groups: EntityGroups, owner?: string | null): Occupancy {
  const defending = owner && groups[owner] ? { [owner]: groups[owner] } : groups

  const totals = new Map<string, number>()
  const healthy = new Map<UnitBaseType, number>()
  const damaged = new Map<UnitBaseType, number>()

  for (const [asyncFaction, entities] of Object.entries(defending)) {
    let total = 0
    for (const entity of entities) {
      if (!isModelledUnit(entity)) continue
      total += entity.count
      const type = UNIT_TYPE_BY_ASYNC_ID[entity.entityId]
      // `[healthy, damaged, galvanized, damaged galvanized]`; galvanize is a
      // separate mark from damage, so it folds into the same two buckets.
      const states = entity.unitStates
      const hurt = states ? (states[1] ?? 0) + (states[3] ?? 0) : 0
      healthy.set(type, (healthy.get(type) ?? 0) + entity.count - hurt)
      damaged.set(type, (damaged.get(type) ?? 0) + hurt)
    }
    if (total > 0) totals.set(asyncFaction, total)
  }

  const ordered = [...totals.entries()].sort((a, b) => b[1] - a[1])
  return {
    factions: ordered.map(([asyncFaction]) => asyncFaction),
    unitCount: ordered.reduce((sum, [, count]) => sum + count, 0),
    unitSummary: summariseUnits(healthy, damaged),
  }
}

export function factionLabel(asyncFactionId: string): string {
  const key = FACTION_BY_ASYNC_ID[asyncFactionId]
  return key ? factions[key].name : asyncFactionId
}

/** A planet's printed name. AsyncTI4 keys planets by a squashed identifier,
 *  so `mrte` has to become `Mecatol Rex` rather than `Mrte`. */
function planetName(planet: string): string {
  return (
    PLANET_NAMES[planet] ?? planet.charAt(0).toUpperCase() + planet.slice(1)
  )
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
 *  fired. Neither beats AsyncTI4 telling us outright which combat is open.
 *
 *  Somewhere with anybody in it beats somewhere empty, so that opening the
 *  dialog lands on a battle that can be run rather than on bare space. */
function rank(location: BattleLocation): number {
  if (location.isActiveCombat) return 0
  if (location.factions.length > 1) return location.mode === 'SPACE' ? 1 : 2
  return location.factions.length === 1 ? 3 : 4
}

/** Every place in the game that holds units this calculator can model, ground
 *  locations split out per planet because ground combat is fought per planet.
 *  The likeliest battles sort first. */
export function listBattleLocations(data: WebData): BattleLocation[] {
  const locations: BattleLocation[] = []
  const activeId = findActiveCombat(data)?.locationId
  // `position:tileId`. The tile id is what says which anomaly a system is.
  const tileIds = new Map(
    (data.tilePositions ?? []).map(entry => {
      const [position, tileId] = entry.split(':')
      return [position, tileId] as const
    }),
  )

  for (const [tile, tileData] of Object.entries(data.tileUnitData)) {
    const tileId = tileIds.get(tile) ?? ''
    // A hyperlane joins systems without being one, and a blank draft tile is
    // setup left over. Ships cannot stop on either, so neither is a battle.
    if (UNPLAYABLE_TILES.has(tileId)) continue
    const environment = ENVIRONMENT_BY_TILE[tileId]
    const systemName = TILE_NAMES[tileId]
    const anomaly = tileData.anomaly ?? undefined

    // Every system offers its space, empty or not: a fight can be planned in
    // one that nobody is sitting in, and an anomaly changes how it goes.
    const space = occupants(tileData.space ?? {})
    locations.push({
      id: tile,
      tile,
      label: `${tile} · space`,
      mode: 'SPACE',
      factions: space.factions,
      unitCount: space.unitCount,
      unitSummary: space.unitSummary,
      isActiveCombat: tile === activeId,
      ...(anomaly && { isAnomaly: true }),
      ...(environment && { environment }),
      ...(systemName && { systemName }),
    })

    for (const [planet, planetData] of Object.entries(tileData.planets ?? {})) {
      // A space station sits in a system's planet list without being a place
      // ground forces can be landed, so it is no kind of battle.
      if (SPACE_STATIONS.has(planet)) continue
      const holder = planetData?.controlledBy
      const ground = occupants(planetData?.entities ?? {}, holder)
      // A planet nobody holds and nobody is standing on is not somewhere a
      // battle happens — troops just land on it. Leaving it out keeps such
      // systems reading like the empty ones they are.
      if (!holder && ground.factions.length === 0) continue
      // Every planet is listed, units or not: an undefended planet is a
      // perfectly good thing to be planning an invasion of, and leaving it out
      // hid it from the map entirely. With nobody standing on it, whoever
      // holds it is the only clue to who you would be fighting.
      const factions =
        ground.factions.length > 0
          ? ground.factions
          : holder && isMappedFaction(holder)
            ? [holder]
            : []
      locations.push({
        id: `${tile}/${planet}`,
        tile,
        planet,
        label: `${tile} · ${planetName(planet)}`,
        mode: 'GROUND',
        factions,
        unitCount: ground.unitCount,
        unitSummary: ground.unitSummary,
        isActiveCombat: `${tile}/${planet}` === activeId,
        ...(anomaly && { isAnomaly: true }),
        ...(environment && { environment }),
        ...(systemName && { systemName }),
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
/** How a location's area reads on its own — `Space`, or the planet's name. */
export function locationAreaLabel(location: { planet?: string }): string {
  return location.planet ? planetName(location.planet) : 'Space'
}

export function isMappedFaction(asyncFactionId: string): boolean {
  return asyncFactionId in FACTION_BY_ASYNC_ID
}
