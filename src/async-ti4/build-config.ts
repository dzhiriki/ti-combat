import type { Ability } from '@/combat'
import { UNIT_LIMITS } from '@/constants/units'
import factions from '@/data/faction'
import type { SerializedConfig } from '@/hooks/combat-setup/serialization'
import type { FactionKey, UnitBaseType, UnitList } from '@/types'

import { AsyncTi4Error } from './fetch-game'
import { entitiesAt, factionLabel } from './locations'
import {
  ABILITY_BY_TECH,
  ABILITY_BY_TF_UNIT,
  FACTION_BY_ASYNC_ID,
  UNIT_TYPE_BY_ASYNC_ID,
  UNIT_UPGRADE_BY_TECH,
  UNMODELLED_TECHS,
} from './mappings'
import {
  type AsyncEntity,
  type AsyncPlayer,
  type BattleLocation,
  EXPECTED_SCHEMA_VERSION,
  type WebData,
} from './types'

export interface ImportSelection {
  location: BattleLocation
  /** AsyncTI4 faction ids. */
  attacker: string
  defender: string
}

export interface ImportResult {
  config: SerializedConfig
  /** Anything the import could not carry across, for display after applying. */
  notes: string[]
}

type UnitCounts = Partial<Record<UnitBaseType, number>>

interface SideData {
  faction: FactionKey
  units: Record<string, [number, 0 | 1]>
  abilities: Record<string, Record<string, unknown>>
}

function increment(counts: UnitCounts, type: UnitBaseType, by: number): void {
  if (by > 0) counts[type] = (counts[type] ?? 0) + by
}

function toUnitList(counts: UnitCounts): UnitList<number> {
  return Object.entries(counts).map(([type, count]) => [
    type,
    count,
  ]) as UnitList<number>
}

/** Structures sit on planets, so a space battle has to reach into the system's
 *  planets to find the PDS and space docks that shoot into it. */
function structuresInSystem(
  data: WebData,
  tile: string,
  asyncFactionId: string,
): AsyncEntity[] {
  const planets = data.tileUnitData[tile]?.planets ?? {}
  return Object.values(planets).flatMap(planet =>
    (planet?.entities?.[asyncFactionId] ?? []).filter(entity => {
      const type = UNIT_TYPE_BY_ASYNC_ID[entity.entityId]
      return type === 'PDS' || type === 'SPACE_DOCK'
    }),
  )
}

/** Everything a side brings to a battle at this location.
 *
 *  Neither combat is confined to its own area of the map. A space battle is
 *  fought by the fleet in the space area — ground forces riding along in it
 *  included, since they are what an invasion commits — plus the structures on
 *  the system's planets, which is where its space cannon fire comes from. A
 *  ground battle adds the fleet overhead to whoever already holds the planet:
 *  those ships carry the invading troops and fire the bombardment. */
function entitiesForBattle(
  data: WebData,
  location: BattleLocation,
  asyncFactionId: string,
): AsyncEntity[] {
  const inSpace = entitiesAt(
    data,
    { ...location, planet: undefined },
    asyncFactionId,
  )
  if (location.mode === 'SPACE') {
    return [
      ...inSpace,
      ...structuresInSystem(data, location.tile, asyncFactionId),
    ]
  }
  return [...entitiesAt(data, location, asyncFactionId), ...inSpace]
}

/** Upstream aliases the Alliance promissory note `<colour>_an`. */
const ALLIANCE_SUFFIX = '_an'

/** Whether this player's commander has come off its unlock condition.
 *
 *  Only an explicit `false` counts as unlocked. A commander the import misses
 *  is one the user can switch on themselves; one it invents changes the odds
 *  under them, so an absent flag leaves the card alone. */
function hasUnlockedCommander(player: AsyncPlayer | undefined): boolean {
  return (player?.leaders ?? []).some(
    leader => leader.type === 'commander' && leader.locked === false,
  )
}

/** The commander ability this calculator models for a faction, if any.
 *
 *  Read off the faction sheets rather than a table of its own, so modelling a
 *  new commander is enough to make the import carry it. Most commanders do
 *  nothing to a combat and aren't modelled at all; those resolve to nothing
 *  and are skipped in silence. */
function commanderAbilityKey(asyncFactionId: string): string | undefined {
  const factionKey = FACTION_BY_ASYNC_ID[asyncFactionId]
  return factionKey
    ? factions[factionKey]?.abilities?.commander?.[0]?.key
    : undefined
}

/** Every commander this side can use.
 *
 *  A commander is on from the moment it unlocks — nothing to spend, nothing
 *  to exhaust — so an unlocked one belongs in the import rather than being
 *  left for the user to remember. A side can also be using someone else's:
 *  an Alliance note in the play area lends its owner's, and Mahact's Imperia
 *  ("while another player's command token is in your fleet pool, you can use
 *  the ability of that player's commander, if it is unlocked") does the same
 *  for every colour in their fleet pool. Both borrow on the same condition —
 *  the lender's own commander has to be unlocked — so both resolve through
 *  the same colour lookup. Mahact purges its Alliance note on setup, so the
 *  two routes never overlap. */
function commanderKeys(data: WebData, asyncFactionId: string): string[] {
  const player = data.playerData.find(p => p.faction === asyncFactionId)
  if (!player) return []

  const lenders = [
    ...(hasUnlockedCommander(player) ? [asyncFactionId] : []),
    ...borrowedFrom(data, player),
  ]
  return lenders
    .map(commanderAbilityKey)
    .filter((key): key is string => key !== undefined)
}

/** The faction ids whose commanders this player is borrowing. */
function borrowedFrom(data: WebData, player: AsyncPlayer): string[] {
  const colours = [
    ...(player.promissoryNotesInPlayArea ?? [])
      .filter(note => note.endsWith(ALLIANCE_SUFFIX))
      .map(note => note.slice(0, -ALLIANCE_SUFFIX.length)),
    ...(player.mahactEdict ?? []),
  ]

  const borrowed: string[] = []
  for (const colour of colours) {
    const lender = data.playerData.find(p => p.color === colour)
    if (lender && hasUnlockedCommander(lender)) borrowed.push(lender.faction)
  }
  return borrowed
}

function buildSide(
  data: WebData,
  location: BattleLocation,
  asyncFactionId: string,
  abilityLookup: Map<string, Ability>,
  notes: Set<string>,
): SideData {
  const faction = FACTION_BY_ASYNC_ID[asyncFactionId]
  if (!faction) {
    throw new AsyncTi4Error(
      `This calculator has no faction sheet for "${asyncFactionId}"`,
    )
  }

  const entities = entitiesForBattle(data, location, asyncFactionId)

  const counts: UnitCounts = {}
  const damaged: UnitCounts = {}
  const galvanized: UnitCounts = {}

  for (const entity of entities) {
    if (entity.entityType !== 'unit') continue
    const type = UNIT_TYPE_BY_ASYNC_ID[entity.entityId]
    if (!type) {
      notes.add(
        `${factionLabel(asyncFactionId)}: "${entity.entityId}" has no equivalent here`,
      )
      continue
    }
    // `[healthy, damaged, galvanized, damaged galvanized]`, falling back to a
    // flat stack when upstream omits the breakdown.
    const states = entity.unitStates ?? [entity.count, 0, 0, 0]
    increment(counts, type, entity.count)
    increment(damaged, type, (states[1] ?? 0) + (states[3] ?? 0))
    increment(galvanized, type, (states[2] ?? 0) + (states[3] ?? 0))
  }

  const player = data.playerData.find(p => p.faction === asyncFactionId)
  const techs = player?.techs ?? []

  const upgraded = new Set<UnitBaseType>()
  const abilities: Record<string, Record<string, unknown>> = {}

  for (const tech of techs) {
    const upgrade = UNIT_UPGRADE_BY_TECH[tech]
    if (upgrade) upgraded.add(upgrade)

    const unmodelled = UNMODELLED_TECHS[tech]
    if (unmodelled) {
      notes.add(
        `${factionLabel(asyncFactionId)}: ${unmodelled} is not modelled`,
      )
    }

    const mapped = ABILITY_BY_TECH[tech]
    if (!mapped) continue
    // One tech can name more than one key where a faction reimplements the
    // card. Every candidate is set; `loadConfig` drops the ones the side's
    // faction doesn't have.
    for (const abilityKey of typeof mapped === 'string' ? [mapped] : mapped) {
      const ability = abilityLookup.get(abilityKey)
      if (!ability) continue
      // Cards gated on a charge count (`headerUI: 'uses'`) start at zero uses,
      // so owning one has to grant a use rather than flip `isEnabled`.
      abilities[abilityKey] =
        ability.headerUI === 'uses' ? { uses: 1 } : { isEnabled: true }
    }
  }

  // Twilight's Fall keeps its unit upgrades in the shared card deck, so they
  // arrive as owned unit sheets rather than researched techs.
  for (const owned of player?.unitsOwned ?? []) {
    const abilityKey = ABILITY_BY_TF_UNIT[owned]
    if (abilityKey && abilityLookup.has(abilityKey)) {
      abilities[abilityKey] = { isEnabled: true }
    }
  }

  // A commander borrowed through an Alliance note belongs to another faction,
  // which the cross-faction commander pool already offers every side. One that
  // doesn't fit — a side that has no commanders at all, or a commander whose
  // card only bears on the other side of the fight — is dropped by
  // `loadConfig` the same way a mismatched tech is.
  for (const abilityKey of commanderKeys(data, asyncFactionId)) {
    if (abilityLookup.has(abilityKey)) {
      abilities[abilityKey] = { isEnabled: true }
    }
  }

  const units: Record<string, [number, 0 | 1]> = {}
  for (const [type, count] of Object.entries(counts) as [
    UnitBaseType,
    number,
  ][]) {
    const limit = UNIT_LIMITS[type]
    if (count > limit) {
      notes.add(
        `${factionLabel(asyncFactionId)}: ${count} ${type} capped at the ${limit} this calculator allows`,
      )
    }
    units[type] = [Math.min(count, limit), upgraded.has(type) ? 1 : 0]
  }
  // Researched upgrades are recorded even where the side has none of that unit
  // here, so the stats are already right when units get added by hand.
  for (const type of upgraded) {
    units[type] ??= [0, 1]
  }

  // Fighters can't take damage, and the ability's own picker excludes them.
  delete damaged.FIGHTER
  if (Object.keys(damaged).length > 0) {
    abilities['PRE_DAMAGED'] = { damagedUnits: toUnitList(damaged) }
  }
  if (Object.keys(galvanized).length > 0) {
    abilities['PRE_GALVANIZED'] = { galvanizedUnits: toUnitList(galvanized) }
  }
  const tokens = player?.galvanizeTokensReinf ?? 0
  if (tokens > 0) {
    abilities['PRE_GALVANIZED'] = {
      ...abilities['PRE_GALVANIZED'],
      reinforcementTokens: tokens,
    }
  }

  return { faction, units, abilities }
}

/** Turn a chosen location and pair of players into a config the calculator can
 *  load, alongside notes on anything that didn't survive the trip. */
export function buildImportConfig(
  data: WebData,
  selection: ImportSelection,
  abilityLookup: Map<string, Ability>,
): ImportResult {
  const notes = new Set<string>()
  const { location } = selection

  // AsyncTI4 is maintained by another project, so treat a schema bump as a
  // hint that these mappings may have gone stale. It is only a warning: most
  // bumps won't touch the few fields read here, and refusing the import over
  // one would be worse than a slightly wrong one the user can see and correct.
  if (
    data.versionSchema != null &&
    data.versionSchema !== EXPECTED_SCHEMA_VERSION
  ) {
    notes.add(
      `AsyncTI4 data format is v${data.versionSchema}, this import expects v${EXPECTED_SCHEMA_VERSION} — some of it may be out of date`,
    )
  }
  const attacker = buildSide(
    data,
    location,
    selection.attacker,
    abilityLookup,
    notes,
  )
  const defender = buildSide(
    data,
    location,
    selection.defender,
    abilityLookup,
    notes,
  )

  // A nebula or an entropic scar is a property of the system, so it applies to
  // whoever fights there. Both sides get it: the scar syncs across them, and
  // the nebula is registered on the defender alone, so an entry for a side
  // that doesn't have the card is dropped when the config loads.
  if (location.environment) {
    const environment = abilityLookup.get(location.environment)
    if (environment) {
      attacker.abilities[location.environment] = { isEnabled: true }
      defender.abilities[location.environment] = { isEnabled: true }
    }
  }

  return {
    config: {
      v: 1,
      af: attacker.faction,
      df: defender.faction,
      m: location.mode === 'SPACE' ? 'S' : 'G',
      au: attacker.units,
      du: defender.units,
      aa: attacker.abilities,
      da: defender.abilities,
    },
    notes: [...notes],
  }
}
